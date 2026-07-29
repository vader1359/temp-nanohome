import { describe, expect, it } from "vitest";

import {
  buildSePayTestPaymentInstruction,
  SEPAY_SANDBOX_API_BASE_URL,
} from "./checkout";

describe("SePay Test payment instruction", () => {
  it.each([125000.01, Number.MAX_SAFE_INTEGER + 1, 0])(
    "rejects non-canonical VND amount %d",
    (amount) => {
      expect(() => buildSePayTestPaymentInstruction({
        amount,
        currency: "VND",
        merchantReference: "WEB-TEST001",
        paymentState: "pending",
      })).toThrow("SePay Test VND amounts must be positive safe integers");
    },
  );

  it("returns sandbox-only pending instructions without a production redirect", () => {
    expect(SEPAY_SANDBOX_API_BASE_URL).toBe("https://userapi-sandbox.sepay.vn/v2");
    expect(buildSePayTestPaymentInstruction({
      amount: 150000,
      currency: "VND",
      merchantReference: "WEB-TEST001",
      paymentState: "pending",
    })).toEqual({
      amount: 150000,
      currency: "VND",
      environment: "sandbox",
      merchantReference: "WEB-TEST001",
      paymentState: "pending",
    });
  });

  it("rejects browser-shaped or arbitrary payment references", () => {
    expect(() => buildSePayTestPaymentInstruction({
      amount: 150000,
      currency: "VND",
      merchantReference: "attacker reference",
      paymentState: "pending",
    })).toThrow(/canonical server merchant reference/);
  });
});
