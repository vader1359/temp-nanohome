import "server-only";

import type { AuthenticatedAccount } from "./auth-port";
import { createFakeAccountWishlistRepository, type AccountWishlistRepository } from "./wishlist-repository.server";

export type AccountWishlistAvailability = "available" | "unavailable";

export type AccountWishlistItem = Readonly<{
  readonly availability: AccountWishlistAvailability;
  readonly href: string;
  readonly title: string;
  readonly variantId: string;
}>;

export type GuestWishlistMerge = Readonly<{
  readonly idempotencyKey: string;
  readonly variantIds: readonly string[];
}>;

export interface AccountWishlistPort {
  readonly addItem: (account: AuthenticatedAccount, variantId: string) => Promise<readonly AccountWishlistItem[]>;
  readonly getItems: (account: AuthenticatedAccount) => Promise<readonly AccountWishlistItem[]>;
  readonly mergeGuestItems: (account: AuthenticatedAccount, input: GuestWishlistMerge) => Promise<readonly AccountWishlistItem[]>;
  readonly removeItem: (account: AuthenticatedAccount, variantId: string) => Promise<readonly AccountWishlistItem[]>;
}

function canonicalize(variantIds: readonly string[]): readonly string[] {
  return [...new Set(variantIds)].sort((left, right) => left.localeCompare(right));
}

function presentItem(account: AuthenticatedAccount, variantId: string): AccountWishlistItem {
  const availability: AccountWishlistAvailability = variantId.startsWith("unavailable-") ? "unavailable" : "available";
  return {
    availability,
    href: `/${account.locale}/products/${encodeURIComponent(variantId)}`,
    title: `Sản phẩm ${variantId}`,
    variantId,
  };
}

function presentItems(account: AuthenticatedAccount, variantIds: readonly string[]): readonly AccountWishlistItem[] {
  return variantIds.map((variantId) => presentItem(account, variantId));
}

export function createFakeAccountWishlistPort(repository: AccountWishlistRepository = createFakeAccountWishlistRepository()): AccountWishlistPort {
  const mergeOperations = new Map<string, Promise<readonly AccountWishlistItem[]>>();

  return {
    getItems: async (account) => presentItems(account, await repository.getItems(account.accountId)),
    addItem: async (account, variantId) => {
      const variantIds = canonicalize([...await repository.getItems(account.accountId), variantId]);
      await repository.saveItems(account.accountId, variantIds);
      return presentItems(account, variantIds);
    },
    removeItem: async (account, variantId) => {
      const variantIds = (await repository.getItems(account.accountId)).filter((currentId) => currentId !== variantId);
      await repository.saveItems(account.accountId, variantIds);
      return presentItems(account, variantIds);
    },
    mergeGuestItems: async (account, input) => {
      const key = `${account.accountId}:${input.idempotencyKey}`;
      const existingOperation = mergeOperations.get(key);
      if (existingOperation !== undefined) return existingOperation;
      const operation = (async () => {
        const receipt = await repository.getMergeReceipt(account.accountId, input.idempotencyKey);
        if (receipt !== null) return presentItems(account, receipt);
        const variantIds = canonicalize([...await repository.getItems(account.accountId), ...input.variantIds]);
        await repository.saveItems(account.accountId, variantIds);
        await repository.saveMergeReceipt(account.accountId, input.idempotencyKey, variantIds);
        return presentItems(account, variantIds);
      })();
      mergeOperations.set(key, operation);
      try {
        return await operation;
      } finally {
        mergeOperations.delete(key);
      }
    },
  };
}
