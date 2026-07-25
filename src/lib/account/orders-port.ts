import "server-only";

import type { AuthenticatedAccount } from "./auth-port";

export type AccountOrderStatus = "paid" | "fulfilled";

export type AccountOrder = {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly placedAt: string;
  readonly status: AccountOrderStatus;
  readonly total: {
    readonly amount: number;
    readonly currency: string;
  };
};

export type AccountOrderSeed = {
  readonly accountId: string;
  readonly order: AccountOrder;
};

export type AccountOrderPage = {
  readonly orders: readonly AccountOrder[];
  readonly nextCursor: string | null;
};

export type AccountOrderPageRequest = {
  readonly cursor?: string | null;
  readonly limit: number;
};

export interface AccountOrdersPort {
  readonly getOrder: (account: AuthenticatedAccount, orderId: string) => Promise<AccountOrder | null>;
  readonly listOrders: (account: AuthenticatedAccount, page: AccountOrderPageRequest) => Promise<AccountOrderPage>;
}

type CursorPosition = {
  readonly accountId: string;
  readonly start: number;
};

function cloneOrder(order: AccountOrder): AccountOrder {
  return { ...order, total: { ...order.total } };
}

export function createFakeAccountOrdersPort(seeds: readonly AccountOrderSeed[] = []): AccountOrdersPort {
  const ordersByAccount = new Map<string, readonly AccountOrder[]>();
  const cursors = new Map<string, CursorPosition>();
  let nextCursorId = 1;

  for (const seed of seeds) {
    const currentOrders = ordersByAccount.get(seed.accountId) ?? [];
    ordersByAccount.set(seed.accountId, [...currentOrders, cloneOrder(seed.order)]);
  }

  for (const [accountId, orders] of ordersByAccount) {
    ordersByAccount.set(
      accountId,
      [...orders].sort((left, right) => right.placedAt.localeCompare(left.placedAt) || right.orderId.localeCompare(left.orderId)),
    );
  }

  function createCursor(accountId: string, start: number): string {
    const cursor = `cursor_${nextCursorId}`;
    nextCursorId += 1;
    cursors.set(cursor, { accountId, start });
    return cursor;
  }

  return {
    getOrder: async (account, orderId) => {
      const order = ordersByAccount.get(account.accountId)?.find((candidate) => candidate.orderId === orderId);
      return order === undefined ? null : cloneOrder(order);
    },
    listOrders: async (account, page) => {
      const position = page.cursor === null || page.cursor === undefined ? undefined : cursors.get(page.cursor);
      const orders = ordersByAccount.get(account.accountId) ?? [];
      const start = position === undefined || position.accountId !== account.accountId ? 0 : position.start;
      const pageOrders = orders.slice(start, start + page.limit).map(cloneOrder);
      const nextStart = start + pageOrders.length;
      const nextCursor = nextStart < orders.length ? createCursor(account.accountId, nextStart) : null;
      return { orders: pageOrders, nextCursor };
    },
  };
}
