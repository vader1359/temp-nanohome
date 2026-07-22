import { describe, expect, it } from "vitest";

import { createHmac } from "node:crypto";

import { createZaloPayGateway } from "./zalopay-adapter";
import { canTransitionCommerceState } from "./transition-policy";
import type { CommerceState } from "./domain";

const initial: CommerceState = {
  order: "created",
  inventory: "unchecked",
  amisExport: "not_started",
  payment: "requires_method",
};

describe("commerce transition policy", () => {
  it("allows an order transition without changing inventory", () => {
    expect(
      canTransitionCommerceState(initial, { ...initial, order: "processing" }),
    ).toBe(true);
  });

  it("allows an inventory transition without changing order", () => {
    expect(
      canTransitionCommerceState(initial, { ...initial, inventory: "checking" }),
    ).toBe(true);
  });

  it("requires provider evidence before payment becomes paid", () => {
    const paid: CommerceState = { ...initial, payment: "paid" };
    const data = JSON.stringify({ app_id: 2554, app_trans_id: "260722-1", amount: 1000, zp_trans_id: "zp-1", return_code: 1 });
    const gateway = createZaloPayGateway({
      appId: 2554,
      key1: "key-1",
      key2: "key-2",
      transport: {
        createOrder: async () => ({}),
        queryOrder: async () => ({}),
        refund: async () => ({}),
        queryRefund: async () => ({}),
      },
    });
    const evidence = gateway.verifyCallback(
      { data, mac: createHmac("sha256", "key-2").update(data).digest("hex") },
      { orderId: "order-1", appTransId: "260722-1", amount: 1000 },
    );

    expect(canTransitionCommerceState(initial, paid)).toBe(false);
    expect(evidence.kind).toBe("paid");
    if (evidence.kind === "paid") expect(canTransitionCommerceState(initial, paid, evidence.evidence)).toBe(true);
  });

  it("accepts query-paid evidence and rejects unevidenced or forged transitions", async () => {
    const paid: CommerceState = { ...initial, payment: "paid" };
    const gateway = createZaloPayGateway({
      appId: 2554,
      key1: "key-1",
      key2: "key-2",
      transport: {
        createOrder: async () => ({}),
        queryOrder: async () => ({ return_code: 1, zp_trans_id: "zp-88", amount: 2000 }),
        refund: async () => ({}),
        queryRefund: async () => ({}),
      },
    });

    const result = await gateway.queryOrder({
      orderId: "order-88",
      appTransId: "260722-88",
      amount: 2000,
    });

    expect(result.kind).toBe("paid");
    if (result.kind === "paid") {
      expect(canTransitionCommerceState(initial, paid, result.evidence)).toBe(true);
    }

    const forgedEvidence = {
      provider: "zalopay",
      orderId: "order-88",
      appTransId: "260722-88",
      zpTransId: "zp-88",
      amount: 2000,
    };

    expect(canTransitionCommerceState(initial, paid, forgedEvidence)).toBe(false);
  });
});
