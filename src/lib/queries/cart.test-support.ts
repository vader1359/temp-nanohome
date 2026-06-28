type CartRow = {
  readonly id: string;
  readonly user_id: string | null;
  readonly guest_id: string | null;
  readonly merged_from_guest_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

type CartItemRow = {
  readonly id: string;
  readonly cart_id: string;
  readonly variant_id: string;
  readonly quantity: number;
  readonly created_at: string;
  readonly updated_at: string;
};

type CartInsert = {
  readonly user_id?: string;
};

type CartUpdate = {
  readonly merged_from_guest_id?: string;
};

type CartItemInsert = {
  readonly cart_id: string;
  readonly variant_id: string;
  readonly quantity: number;
};

type CartItemUpdate = {
  readonly quantity: number;
};

type CartItemQueryFilter = {
  cartId?: string;
  variantId?: string;
  id?: string;
};

const timestamp = "2026-06-28T00:00:00.000Z";

export const state: {
  readonly carts: Map<string, CartRow>;
  readonly cartItems: Map<string, CartItemRow>;
  readonly insertedItems: CartItemInsert[];
  readonly updatedItems: CartItemUpdate[];
} = {
  carts: new Map<string, CartRow>(),
  cartItems: new Map<string, CartItemRow>(),
  insertedItems: [],
  updatedItems: [],
};

export function resetCartTestState(): void {
  state.carts.clear();
  state.cartItems.clear();
  state.insertedItems.length = 0;
  state.updatedItems.length = 0;
}

export function seedCart(cart: Pick<CartRow, "id" | "user_id" | "merged_from_guest_id">): void {
  state.carts.set(cart.id, makeCart(cart));
}

export function seedCartItem(item: Pick<CartItemRow, "id" | "cart_id" | "variant_id" | "quantity">): void {
  state.cartItems.set(item.id, makeCartItem(item));
}

export function createSupabaseFake() {
  return {
    from(table: string) {
      if (table === "carts") {
        return createCartsTableFake();
      }

      if (table === "cart_items") {
        return createCartItemsTableFake();
      }

      throw new RangeError(`unexpected table ${table}`);
    },
  };
}

function createCartsTableFake() {
  return {
    select() {
      return createCartSelectQuery();
    },
    insert(rows: readonly CartInsert[]) {
      const row = rows[0];
      const cart = makeCart({ id: `cart-${state.carts.size + 1}`, user_id: row?.user_id ?? null, merged_from_guest_id: null });
      state.carts.set(cart.id, cart);
      return { select: () => ({ single: async () => ({ data: cart, error: null }) }) };
    },
    update(row: CartUpdate) {
      return createCartUpdateQuery(row);
    },
  };
}

function createCartSelectQuery() {
  let userId: string | undefined;

  return {
    eq(column: string, value: string) {
      if (column === "user_id") {
        userId = value;
      }
      return this;
    },
    async maybeSingle() {
      const cart = [...state.carts.values()].find((candidate) => candidate.user_id === userId) ?? null;
      return { data: cart, error: null };
    },
  };
}

function createCartUpdateQuery(row: CartUpdate) {
  let cartId: string | undefined;

  return {
    eq(column: string, value: string) {
      if (column === "id") {
        cartId = value;
      }
      return this;
    },
    select() {
      return {
        single: async () => {
          const existing = cartId === undefined ? undefined : state.carts.get(cartId);
          if (existing === undefined) {
            return { data: null, error: new Error("cart not found") };
          }
          const next = { ...existing, merged_from_guest_id: row.merged_from_guest_id ?? null };
          state.carts.set(next.id, next);
          return { data: next, error: null };
        },
      };
    },
  };
}

function createCartItemsTableFake() {
  return {
    select() {
      return createCartItemsSelectQuery();
    },
    insert(rows: readonly CartItemInsert[]) {
      const row = rows[0];
      if (row === undefined) {
        return { select: () => ({ single: async () => ({ data: null, error: new Error("missing row") }) }) };
      }
      state.insertedItems.push(row);
      const item = makeCartItem({ id: `item-${state.cartItems.size + 1}`, ...row });
      state.cartItems.set(item.id, item);
      return { select: () => ({ single: async () => ({ data: item, error: null }) }) };
    },
    update(row: CartItemUpdate) {
      state.updatedItems.push(row);
      return createCartItemUpdateQuery(row);
    },
    delete() {
      return { eq: async (_column: string, id: string) => ({ error: deleteCartItem(id) }) };
    },
  };
}

function createCartItemsSelectQuery() {
  const filter: CartItemQueryFilter = {};
  const query = {
    eq(column: string, value: string) {
      if (column === "cart_id") {
        filter.cartId = value;
      }
      if (column === "variant_id") {
        filter.variantId = value;
      }
      if (column === "id") {
        filter.id = value;
      }
      return query;
    },
    order: async () => ({ data: findCartItems(filter), error: null }),
    maybeSingle: async () => ({ data: findCartItems(filter)[0] ?? null, error: null }),
  };
  return query;
}

function createCartItemUpdateQuery(row: CartItemUpdate) {
  let itemId: string | undefined;
  const query = {
    error: null,
    eq(column: string, value: string) {
      if (column === "id") {
        itemId = value;
      }
      return query;
    },
    select() {
      return { single: async () => updateCartItem(itemId, row) };
    },
  };

  return query;
}

function updateCartItem(itemId: string | undefined, row: CartItemUpdate) {
  const existing = itemId === undefined ? undefined : state.cartItems.get(itemId);
  if (existing === undefined) {
    return { data: null, error: new Error("cart item not found") };
  }
  const next = { ...existing, quantity: row.quantity };
  state.cartItems.set(next.id, next);
  return { data: next, error: null };
}

function findCartItems(filter: CartItemQueryFilter): readonly CartItemRow[] {
  return [...state.cartItems.values()].filter((item) => {
    const cartMatches = filter.cartId === undefined || item.cart_id === filter.cartId;
    const variantMatches = filter.variantId === undefined || item.variant_id === filter.variantId;
    const idMatches = filter.id === undefined || item.id === filter.id;
    return cartMatches && variantMatches && idMatches;
  });
}

function deleteCartItem(id: string): null {
  state.cartItems.delete(id);
  return null;
}

function makeCart(cart: Pick<CartRow, "id" | "user_id" | "merged_from_guest_id">): CartRow {
  return { ...cart, guest_id: null, created_at: timestamp, updated_at: timestamp };
}

function makeCartItem(item: Pick<CartItemRow, "id" | "cart_id" | "variant_id" | "quantity">): CartItemRow {
  return { ...item, created_at: timestamp, updated_at: timestamp };
}
