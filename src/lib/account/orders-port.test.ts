import { describe, expect, it } from "vitest";

import { createFakeAccountOrdersPort } from "./orders-port";

const owner = {
  accountId: "account_owner",
  firebaseUid: "firebase_owner",
  locale: "vi",
  identities: [],
} as const;

const otherAccount = {
  accountId: "account_other",
  firebaseUid: "firebase_other",
  locale: "vi",
  identities: [],
} as const;

const seededOrders = [
  {
    accountId: owner.accountId,
    order: {
      orderId: "order_01",
      orderNumber: "NH-1001",
      placedAt: "2026-07-01T10:00:00.000Z",
      status: "paid",
      total: { amount: 125000, currency: "VND" },
    },
  },
  {
    accountId: owner.accountId,
    order: {
      orderId: "order_02",
      orderNumber: "NH-1002",
      placedAt: "2026-07-02T10:00:00.000Z",
      status: "fulfilled",
      total: { amount: 240000, currency: "VND" },
    },
  },
  {
    accountId: otherAccount.accountId,
    order: {
      orderId: "order_other",
      orderNumber: "NH-2001",
      placedAt: "2026-07-03T10:00:00.000Z",
      status: "paid",
      total: { amount: 90000, currency: "VND" },
    },
  },
] as const;

describe("createFakeAccountOrdersPort", () => {
  it("returns null for a missing order", async () => {
    // Given: an account with historical orders.
    const port = createFakeAccountOrdersPort(seededOrders);

    // When: the account requests an absent order.
    const order = await port.getOrder(owner, "order_missing");

    // Then: the fake reports the order as unavailable.
    expect(order).toBeNull();
  });

  it("returns null for another account's order", async () => {
    // Given: orders owned by separate Account identities.
    const port = createFakeAccountOrdersPort(seededOrders);

    // When: an account requests an order outside its ownership scope.
    const order = await port.getOrder(owner, "order_other");

    // Then: the fake fails closed without exposing the order.
    expect(order).toBeNull();
  });

  it("returns opaque cursors for the next account-scoped page", async () => {
    // Given: an account with two historical orders.
    const port = createFakeAccountOrdersPort(seededOrders);

    // When: it requests one order per page.
    const firstPage = await port.listOrders(owner, { limit: 1 });
    const secondPage = await port.listOrders(owner, { cursor: firstPage.nextCursor, limit: 1 });

    // Then: the cursor advances through newest-first account history.
    expect(firstPage.orders.map((order) => order.orderId)).toEqual(["order_02"]);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    expect(firstPage.nextCursor).not.toBe("order_02");
    expect(secondPage.orders.map((order) => order.orderId)).toEqual(["order_01"]);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("treats a foreign cursor like an invalid cursor", async () => {
    // Given: an opaque cursor created for another account.
    const port = createFakeAccountOrdersPort(seededOrders);
    const otherPage = await port.listOrders(otherAccount, { limit: 1 });

    // When: the owner submits that cursor.
    const result = await port.listOrders(owner, { cursor: otherPage.nextCursor, limit: 1 });

    // Then: pagination restarts without exposing the other account history.
    expect(result.orders.map((order) => order.orderId)).toEqual(["order_02"]);
  });

  it("returns independent historical snapshots", async () => {
    // Given: a fake initialized with historical orders.
    const port = createFakeAccountOrdersPort(seededOrders);

    // When: the owner resolves the same order twice.
    const first = await port.getOrder(owner, "order_01");
    const second = await port.getOrder(owner, "order_01");

    // Then: the readonly snapshots and nested totals are distinct values.
    expect(first).not.toBe(second);
    expect(first?.total).not.toBe(second?.total);
    expect(second).toMatchObject({ total: { amount: 125000, currency: "VND" } });
  });
});
