import "server-only";

export interface AccountWishlistRepository {
  readonly getItems: (accountId: string) => Promise<readonly string[]>;
  readonly getMergeReceipt: (accountId: string, idempotencyKey: string) => Promise<readonly string[] | null>;
  readonly saveItems: (accountId: string, variantIds: readonly string[]) => Promise<void>;
  readonly saveMergeReceipt: (accountId: string, idempotencyKey: string, variantIds: readonly string[]) => Promise<void>;
}

function receiptKey(accountId: string, idempotencyKey: string): string {
  return `${accountId}:${idempotencyKey}`;
}

export function createFakeAccountWishlistRepository(): AccountWishlistRepository {
  const itemsByAccount = new Map<string, readonly string[]>();
  const receipts = new Map<string, readonly string[]>();

  return {
    getItems: async (accountId) => itemsByAccount.get(accountId) ?? [],
    getMergeReceipt: async (accountId, idempotencyKey) => receipts.get(receiptKey(accountId, idempotencyKey)) ?? null,
    saveItems: async (accountId, variantIds) => { itemsByAccount.set(accountId, [...variantIds]); },
    saveMergeReceipt: async (accountId, idempotencyKey, variantIds) => { receipts.set(receiptKey(accountId, idempotencyKey), [...variantIds]); },
  };
}
