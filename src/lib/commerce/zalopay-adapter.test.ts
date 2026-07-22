import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createZaloPayGateway,
  type ZaloPayGatewayTransport,
} from "./zalopay-adapter";

const keys = { appId: 2554, key1: "key-1", key2: "key-2" } as const;

describe("ZaloPay adapter", () => {
  it("creates and queries orders through typed signed transport calls", async () => {
    const calls: string[] = [];
    const transport: ZaloPayGatewayTransport = {
      createOrder: async (body, mac) => {
        calls.push(`${body.app_id}:${body.app_trans_id}:${mac}`);
        return { return_code: 1, order_url: "https://checkout.invalid" };
      },
      queryOrder: async (_body, mac) => {
        calls.push(mac);
        return { return_code: 1, zp_trans_id: "zp-1", amount: 1000 };
      },
      refund: async () => ({ return_code: 1, refund_id: "rf-1" }),
      queryRefund: async () => ({ return_code: 1, refund_status: 2 }),
    };
    const gateway = createZaloPayGateway({ ...keys, transport });

    const created = await gateway.createOrder({
      orderId: "order-1",
      appTransId: "260722-1",
      amount: 1000,
      appUser: "web",
      appTime: 1784716800000,
      embedData: "{}",
      item: "[]",
    });
    const queried = await gateway.queryOrder({ orderId: "order-1", appTransId: "260722-1", amount: 1000 });

    expect(created).toEqual({ kind: "created", orderUrl: "https://checkout.invalid" });
    expect(queried).toEqual({
      kind: "paid",
      orderId: "order-1",
      appTransId: "260722-1",
      zpTransId: "zp-1",
      amount: 1000,
      evidence: expect.objectContaining({
        provider: "zalopay",
        orderId: "order-1",
        appTransId: "260722-1",
        zpTransId: "zp-1",
        amount: 1000,
      }),
    });
    expect(calls[0]).toContain("2554:260722-1:");
  });

  it("verifies callback bytes and binds the trusted payload to the expected order", () => {
    const gateway = createZaloPayGateway({
      ...keys,
      transport: emptyTransport(),
    });
    const data = JSON.stringify({ app_id: 2554, app_trans_id: "260722-1", amount: 1000, zp_trans_id: "zp-1", return_code: 1 });
    const mac = createHmac("sha256", keys.key2).update(new TextEncoder().encode(data)).digest("hex");

    expect(gateway.verifyCallback({ data, mac }, { orderId: "order-1", appTransId: "260722-1", amount: 1000 })).toEqual({
      kind: "paid",
      orderId: "order-1",
      appTransId: "260722-1",
      zpTransId: "zp-1",
      amount: 1000,
      evidence: expect.objectContaining({ provider: "zalopay", orderId: "order-1", appTransId: "260722-1", zpTransId: "zp-1", amount: 1000 }),
    });
    expect(gateway.verifyCallback({ data, mac }, { orderId: "order-1", appTransId: "260722-2", amount: 1000 })).toEqual({ kind: "rejected", reason: "order_mismatch" });
  });

  it("rejects verified callbacks without a transaction identity", () => {
    const gateway = createZaloPayGateway({ ...keys, transport: emptyTransport() });
    const data = JSON.stringify({ app_id: 2554, app_trans_id: "260722-1", amount: 1000, zp_trans_id: "", return_code: 1 });
    const mac = createHmac("sha256", keys.key2).update(new TextEncoder().encode(data)).digest("hex");

    expect(gateway.verifyCallback({ data, mac }, { orderId: "order-1", appTransId: "260722-1", amount: 1000 })).toEqual({ kind: "rejected", reason: "payload" });
  });

  it("only returns refunded after query-refund confirms final success", async () => {
    const gateway = createZaloPayGateway({ ...keys, transport: emptyTransport() });
    const requested = await gateway.refund({ appTransId: "260722-1", zpTransId: "zp-1", amount: 1000, description: "stock conflict", merchantRefundId: "refund-order-1" });
    if (requested.kind !== "processing") throw new Error("expected refund processing");
    const final = await gateway.queryRefund({ merchantRefundId: requested.merchantRefundId });

    expect(requested.kind).toBe("processing");
    expect(final).toEqual({ kind: "refunded", merchantRefundId: requested.merchantRefundId });
  });

  it("reuses the caller-provided merchant refund ID across retries", async () => {
    const refundIds: string[] = [];
    const gateway = createZaloPayGateway({
      ...keys,
      transport: {
        ...emptyTransport(),
        refund: async (body) => {
          refundIds.push(String(body.m_refund_id));
          return { return_code: 1, refund_id: "rf-1" };
        },
      },
    });

    await gateway.refund({ appTransId: "260722-1", zpTransId: "zp-1", amount: 1000, description: "stock conflict", merchantRefundId: "refund-order-1" });
    await gateway.refund({ appTransId: "260722-1", zpTransId: "zp-1", amount: 1000, description: "stock conflict", merchantRefundId: "refund-order-1" });

    expect(refundIds).toEqual(["refund-order-1", "refund-order-1"]);
  });

  it("preserves processing and terminal query states", async () => {
    const responses = [{ return_code: 3, zp_trans_id: "", amount: 0 }, { return_code: 2, zp_trans_id: "", amount: 0 }];
    const gateway = createZaloPayGateway({ ...keys, transport: { ...emptyTransport(), queryOrder: async () => responses.shift() ?? { return_code: 2, zp_trans_id: "", amount: 0 } } });

    await expect(gateway.queryOrder({ orderId: "order-1", appTransId: "260722-1", amount: 1000 })).resolves.toEqual({ kind: "processing" });
    await expect(gateway.queryOrder({ orderId: "order-1", appTransId: "260722-1", amount: 1000 })).resolves.toEqual({ kind: "failed" });
  });

  it("produces non-forgeable evidence bound to order, app transaction, ZaloPay transaction, and amount when query returns paid", async () => {
    const gateway = createZaloPayGateway({
      ...keys,
      transport: {
        ...emptyTransport(),
        queryOrder: async () => ({ return_code: 1, zp_trans_id: "zp-99", amount: 5000 }),
      },
    });

    const result = await gateway.queryOrder({
      orderId: "order-99",
      appTransId: "260722-99",
      amount: 5000,
    });

    expect(result).toEqual({
      kind: "paid",
      orderId: "order-99",
      appTransId: "260722-99",
      zpTransId: "zp-99",
      amount: 5000,
      evidence: expect.objectContaining({
        provider: "zalopay",
        orderId: "order-99",
        appTransId: "260722-99",
        zpTransId: "zp-99",
        amount: 5000,
      }),
    });
  });
});

const emptyTransport = (): ZaloPayGatewayTransport => ({
  createOrder: async () => ({ return_code: 1, order_url: "https://checkout.invalid" }),
  queryOrder: async () => ({ return_code: 3, zp_trans_id: "", amount: 0 }),
  refund: async () => ({ return_code: 1, refund_id: "rf-1" }),
  queryRefund: async () => ({ return_code: 1, refund_status: 2 }),
});
