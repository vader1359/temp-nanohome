import type { AuthenticatedAccount } from "./auth-port";
import type {
  AccountDataRepository,
  StoredAccountCart,
} from "./account-data-repository.server";
import type { CartMutationInput, CartRemovalInput, GuestCartMergeInput } from "./cart-schema";
import { createFakeAccountCartRepository, type AccountCartRepository, type StoredCart, type StoredCartItem } from "./cart-repository.server";

// Bounded local-fake catalog: listed variants only, max 10 per variant, 50 guest entries.
const catalog = [
  { amount: 1290000, slug: "chair-oak", title: "Ghế gỗ sồi" },
  { amount: 1890000, slug: "lamp-linen", title: "Đèn vải lanh" },
  { amount: 890000, slug: "table-side", title: "Bàn bên tối giản" },
] as const;

type CatalogItem = (typeof catalog)[number];
export type AccountCart = Readonly<{
  readonly items: readonly Readonly<{
    readonly available: boolean;
    readonly href: string;
    readonly lineTotal: Readonly<{ readonly amount: number; readonly currency: "VND" }>;
    readonly quantity: number;
    readonly title: string;
    readonly unitPrice: Readonly<{ readonly amount: number; readonly currency: "VND" }>;
    readonly variantId: string;
  }>[];
  readonly mergeSummary?: Readonly<{
    readonly changedLines: number;
    readonly removedLines: number;
  }>;
  readonly total: Readonly<{ readonly amount: number; readonly currency: "VND" }>;
  readonly version: number;
}>;
export type CartMutationResult = Readonly<{
  readonly cart: AccountCart;
  readonly status: "unavailable" | "updated" | "version_conflict";
}>;
export interface AccountCartPort {
  addItem(account: AuthenticatedAccount, input: CartMutationInput): Promise<CartMutationResult>;
  getCart(account: AuthenticatedAccount): Promise<AccountCart>;
  mergeGuestCart(account: AuthenticatedAccount, input: GuestCartMergeInput): Promise<AccountCart>;
  removeItem(account: AuthenticatedAccount, input: CartRemovalInput): Promise<CartMutationResult>;
  updateItem(account: AuthenticatedAccount, input: CartMutationInput): Promise<CartMutationResult>;
}

function catalogItem(variantId: string): CatalogItem | null { return catalog.find((item) => item.slug === variantId) ?? null; }
function present(cart: StoredCart, locale: string): AccountCart {
  const items = cart.items.flatMap((item) => {
    const product = catalogItem(item.variantId);
    return product === null ? [] : [{ available: true, href: `/${locale}/products/${product.slug}`, lineTotal: { amount: product.amount * item.quantity, currency: "VND" as const }, quantity: item.quantity, title: product.title, unitPrice: { amount: product.amount, currency: "VND" as const }, variantId: product.slug }];
  });
  return { items, total: { amount: items.reduce((total, item) => total + item.lineTotal.amount, 0), currency: "VND" }, version: cart.version };
}
function withQuantity(cart: StoredCart, variantId: string, quantity: number): StoredCart {
  const exists = cart.items.some((item) => item.variantId === variantId);
  const items = exists ? cart.items.map((item) => item.variantId === variantId ? { quantity, variantId } : item) : [...cart.items, { quantity, variantId }];
  return { items, version: cart.version + 1 };
}

export function createFakeAccountCartPort(repository: AccountCartRepository = createFakeAccountCartRepository()): AccountCartPort {
  async function mutate(account: AuthenticatedAccount, expectedVersion: number, apply: (cart: StoredCart) => StoredCart): Promise<CartMutationResult> {
    const current = await repository.getCart(account.accountId);
    if (current.version !== expectedVersion) return { cart: present(current, account.locale), status: "version_conflict" };
    const next = apply(current);
    await repository.saveCart(account.accountId, next);
    return { cart: present(next, account.locale), status: "updated" };
  }
  return {
    async getCart(account) { return present(await repository.getCart(account.accountId), account.locale); },
    async addItem(account, input) { return catalogItem(input.variantId) === null ? mutate(account, input.expectedVersion, (cart) => cart) : mutate(account, input.expectedVersion, (cart) => withQuantity(cart, input.variantId, Math.min(10, (cart.items.find((item) => item.variantId === input.variantId)?.quantity ?? 0) + input.quantity))); },
    async updateItem(account, input) { return catalogItem(input.variantId) === null ? mutate(account, input.expectedVersion, (cart) => cart) : mutate(account, input.expectedVersion, (cart) => withQuantity(cart, input.variantId, input.quantity)); },
    async removeItem(account, input) { return mutate(account, input.expectedVersion, (cart) => ({ items: cart.items.filter((item) => item.variantId !== input.variantId), version: cart.version + 1 })); },
    async mergeGuestCart(account, input) {
      const receipt = await repository.getMergeReceipt(account.accountId, input.idempotencyKey);
      if (receipt !== null) return present(receipt, account.locale);
      const current = await repository.getCart(account.accountId);
      const mergedItemsMap = new Map<string, number>(current.items.map((item) => [item.variantId, item.quantity]));
      for (const item of input.items) {
        if (catalogItem(item.variantId) !== null) {
          const currentQty = mergedItemsMap.get(item.variantId) ?? 0;
          mergedItemsMap.set(item.variantId, Math.min(10, currentQty + item.quantity));
        }
      }
      const newItems: StoredCartItem[] = Array.from(mergedItemsMap.entries()).map(([variantId, quantity]) => ({ quantity, variantId }));
      const hasChanged = newItems.length !== current.items.length || newItems.some((newItem) => {
        const existing = current.items.find((item) => item.variantId === newItem.variantId);
        return existing === undefined || existing.quantity !== newItem.quantity;
      });
      const nextCart: StoredCart = {
        items: newItems,
        version: hasChanged ? current.version + 1 : current.version,
      };
      await repository.saveCart(account.accountId, nextCart);
      await repository.saveMergeReceipt(account.accountId, input.idempotencyKey, nextCart);
      return present(nextCart, account.locale);
    },
  };
}

type DurableCartRepository = Pick<
  AccountDataRepository,
  "getCart" | "mergeGuestCart" | "mutateCart"
>;

function presentDurableCart(
  cart: StoredAccountCart,
  locale: string,
  mergeSummary?: AccountCart["mergeSummary"],
): AccountCart {
  const items = cart.items.map((item) => {
    const unitAmount = item.available ? item.unitAmount : 0;
    return {
      available: item.available,
      href: item.productSlug === null
        ? `/${locale}/products`
        : `/${locale}/products/${item.productSlug}`,
      lineTotal: {
        amount: unitAmount * item.quantity,
        currency: "VND" as const,
      },
      quantity: item.quantity,
      title: item.title,
      unitPrice: {
        amount: unitAmount,
        currency: "VND" as const,
      },
      variantId: item.variantId,
    };
  });
  return {
    items,
    ...(mergeSummary === undefined ? {} : { mergeSummary }),
    total: {
      amount: items.reduce((total, item) => total + item.lineTotal.amount, 0),
      currency: "VND",
    },
    version: cart.version,
  };
}

export function createAccountCartPort(repository: DurableCartRepository): AccountCartPort {
  async function mutate(
    account: AuthenticatedAccount,
    input: CartMutationInput | CartRemovalInput,
    operation: "add" | "remove" | "update",
  ): Promise<CartMutationResult> {
    const result = await repository.mutateCart(account.accountId, {
      expectedVersion: input.expectedVersion,
      operation,
      quantity: "quantity" in input ? input.quantity : null,
      variantId: input.variantId,
    });
    const cart = await repository.getCart(account.accountId);
    return {
      cart: presentDurableCart(cart, account.locale),
      status: result.status,
    };
  }

  return {
    addItem: (account, input) => mutate(account, input, "add"),
    async getCart(account) {
      return presentDurableCart(await repository.getCart(account.accountId), account.locale);
    },
    async mergeGuestCart(account, input) {
      const summary = await repository.mergeGuestCart(
        account.accountId,
        input.idempotencyKey,
        input.items,
      );
      const cart = await repository.getCart(account.accountId);
      return presentDurableCart(cart, account.locale, {
        changedLines: summary.changedLines,
        removedLines: summary.removedLines,
      });
    },
    removeItem: (account, input) => mutate(account, input, "remove"),
    updateItem: (account, input) => mutate(account, input, "update"),
  };
}
