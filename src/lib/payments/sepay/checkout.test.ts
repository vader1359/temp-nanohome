import { describe, expect, it } from "vitest";

import {
  isExpectedSePayTestVietQrUrl,
  isSePayTestPaymentReference,
  SEPAY_TEST_VIETQR_URL,
} from "./checkout";

const expected = {
  amount: 150000,
  merchantReference: "WEB0123456789AB",
} as const;

function validUrl(): URL {
  const url = new URL(SEPAY_TEST_VIETQR_URL);
  url.searchParams.set("acc", "9988776655");
  url.searchParams.set("bank", "VCB");
  url.searchParams.set("amount", String(expected.amount));
  url.searchParams.set("des", expected.merchantReference);
  url.searchParams.set("template", "compact");
  url.searchParams.set("showinfo", "true");
  url.searchParams.set("fullacc", "true");
  return url;
}

describe("SePay Test Mode checkout contract", () => {
  it("accepts only the configured payment-code shape", () => {
    expect(isSePayTestPaymentReference(expected.merchantReference)).toBe(true);
    expect(isSePayTestPaymentReference("WEB-0123456789AB")).toBe(false);
    expect(isSePayTestPaymentReference("WEB0123")).toBe(false);
  });

  it("accepts the exact VietQR handoff for the server amount and reference", () => {
    expect(isExpectedSePayTestVietQrUrl(validUrl().toString(), expected)).toBe(true);
  });

  it.each([
    ["production-like host", () => {
      const url = validUrl();
      url.hostname = "attacker.test";
      return url;
    }],
    ["amount mismatch", () => {
      const url = validUrl();
      url.searchParams.set("amount", "1");
      return url;
    }],
    ["reference mismatch", () => {
      const url = validUrl();
      url.searchParams.set("des", "WEBFFFFFFFFFFFF");
      return url;
    }],
    ["unexpected query", () => {
      const url = validUrl();
      url.searchParams.set("redirect", "https://attacker.test");
      return url;
    }],
  ])("rejects %s", (_label, mutate) => {
    expect(isExpectedSePayTestVietQrUrl(mutate().toString(), expected)).toBe(false);
  });
});
