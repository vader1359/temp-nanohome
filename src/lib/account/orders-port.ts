import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { AuthenticatedAccount } from "./auth-port";
import type { AccountDataRepository, StoredAccountOrder } from "./account-data-repository.server";

export type AccountOrderStatus = "cancelled" | "expired" | "failed" | "fulfilled" | "paid" | "pending" | "refunded";
export type AccountPaymentStatus = "authorized" | "cancelled" | "failed" | "paid" | "unpaid";
export type AccountRefundStatus = "failed" | "none" | "partial" | "refunded" | "requested";

export type AccountOrderItem = Readonly<{
  readonly productName: string;
  readonly quantity: number;
  readonly sku: string | null;
  readonly unitPrice: number | null;
  readonly variantName: string | null;
}>;

export type AccountOrder = {
  readonly items: readonly AccountOrderItem[];
  readonly orderId: string;
  readonly orderNumber: string;
  readonly paymentStatus: AccountPaymentStatus;
  readonly placedAt: string;
  readonly refundStatus: AccountRefundStatus;
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
  return {
    ...order,
    items: order.items.map((item) => ({ ...item })),
    total: { ...order.total },
  };
}

export function createAccountOrdersPort(
  repository: Pick<AccountDataRepository, "getOrder" | "listOrders">,
  cursorSecret: string,
): AccountOrdersPort {
  return {
    async getOrder(account, orderId) {
      const order = await repository.getOrder(account.accountId, orderId);
      return order === null ? null : presentStoredOrder(order);
    },
    async listOrders(account, page) {
      const limit = Math.max(1, Math.min(50, page.limit));
      const offset = decodeCursor(page.cursor, account.accountId, cursorSecret) ?? 0;
      const rows = await repository.listOrders(account.accountId, {
        limit: limit + 1,
        offset,
      });
      const hasNext = rows.length > limit;
      return {
        orders: rows.slice(0, limit).map(presentStoredOrder),
        nextCursor: hasNext
          ? encodeCursor(account.accountId, offset + limit, cursorSecret)
          : null,
      };
    },
  };
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

function presentStoredOrder(order: StoredAccountOrder): AccountOrder {
  return {
    items: order.items.map((item) => ({
      productName: item.productName ?? item.variantName ?? "Sản phẩm",
      quantity: item.quantity,
      sku: item.sku,
      unitPrice: item.unitPrice,
      variantName: item.variantName,
    })),
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    paymentStatus: normalizePaymentStatus(order.paymentStatus),
    placedAt: order.placedAt,
    refundStatus: normalizeRefundStatus(order.refundStatus),
    status: displayStatus(order),
    total: {
      amount: order.grandTotal,
      currency: order.currency,
    },
  };
}

function displayStatus(order: StoredAccountOrder): AccountOrderStatus {
  if (order.refundStatus === "refunded" || order.refundStatus === "partial") return "refunded";
  if (order.fulfillmentStatus === "delivered" || order.businessStatus === "fulfilled") return "fulfilled";
  if (order.paymentStatus === "paid") return "paid";
  if (order.paymentStatus === "failed") return "failed";
  if (order.paymentStatus === "cancelled" || order.businessStatus === "cancelled") return "cancelled";
  return "pending";
}

function normalizePaymentStatus(value: string): AccountPaymentStatus {
  return ["authorized", "cancelled", "failed", "paid", "unpaid"].includes(value)
    ? value as AccountPaymentStatus
    : "unpaid";
}

function normalizeRefundStatus(value: string): AccountRefundStatus {
  return ["failed", "none", "partial", "refunded", "requested"].includes(value)
    ? value as AccountRefundStatus
    : "none";
}

function encodeCursor(accountId: string, offset: number, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ accountId, offset }), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function decodeCursor(cursor: string | null | undefined, accountId: string, secret: string): number | null {
  if (cursor === null || cursor === undefined) return null;
  const [payload, providedSignature, extra] = cursor.split(".");
  if (payload === undefined || providedSignature === undefined || extra !== undefined) return null;
  const expectedSignature = createHmac("sha256", secret).update(payload).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(providedSignature, "base64url");
  } catch {
    return null;
  }
  if (provided.length !== expectedSignature.length || !timingSafeEqual(provided, expectedSignature)) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      value === null
      || typeof value !== "object"
      || !("accountId" in value)
      || !("offset" in value)
      || value.accountId !== accountId
      || !Number.isInteger(value.offset)
      || typeof value.offset !== "number"
      || value.offset < 0
      || value.offset > 1_000_000
    ) {
      return null;
    }
    return value.offset;
  } catch {
    return null;
  }
}
