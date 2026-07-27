import "server-only";

export type StoredCartItem = Readonly<{ readonly quantity: number; readonly variantId: string }>;
export type StoredCart = Readonly<{ readonly items: readonly StoredCartItem[]; readonly version: number }>;

export interface AccountCartRepository {
  getCart(accountId: string): Promise<StoredCart>;
  getMergeReceipt(accountId: string, idempotencyKey: string): Promise<StoredCart | null>;
  saveCart(accountId: string, cart: StoredCart): Promise<void>;
  saveMergeReceipt(accountId: string, idempotencyKey: string, cart: StoredCart): Promise<void>;
}

function copy(cart: StoredCart): StoredCart {
  return { items: cart.items.map((item) => ({ ...item })), version: cart.version };
}

export function createFakeAccountCartRepository(): AccountCartRepository {
  const carts = new Map<string, StoredCart>();
  const receipts = new Map<string, StoredCart>();
  const empty = (): StoredCart => ({ items: [], version: 0 });
  return {
    async getCart(accountId) { return copy(carts.get(accountId) ?? empty()); },
    async getMergeReceipt(accountId, idempotencyKey) { const cart = receipts.get(`${accountId}:${idempotencyKey}`); return cart === undefined ? null : copy(cart); },
    async saveCart(accountId, cart) { carts.set(accountId, copy(cart)); },
    async saveMergeReceipt(accountId, idempotencyKey, cart) { receipts.set(`${accountId}:${idempotencyKey}`, copy(cart)); },
  };
}
