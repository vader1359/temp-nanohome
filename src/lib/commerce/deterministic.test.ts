import { describe, expect, it } from "vitest";

import { createDeterministicIds } from "./deterministic";

describe("deterministic commerce test support", () => {
  it("generates stable order, payment, and refund identifiers", () => {
    const ids = createDeterministicIds({
      now: new Date("2026-07-22T10:11:12.000Z"),
      seed: "checkout-1",
    });

    expect(ids.orderId()).toBe("WEB-checkout-1-1");
    expect(ids.zalopayAppTransId()).toBe("260722-checkout-1-2");
    expect(ids.refundId()).toBe("REF-checkout-1-3");
  });

  it("increments identifiers deterministically per operation", () => {
    const ids = createDeterministicIds({
      now: new Date("2026-07-22T10:11:12.000Z"),
      seed: "checkout-1",
    });

    ids.orderId();

    expect(ids.orderId()).toBe("WEB-checkout-1-2");
    expect(ids.refundId()).toBe("REF-checkout-1-3");
  });
});
