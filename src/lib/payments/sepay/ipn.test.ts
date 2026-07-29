import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { maximumSePayIpnBodyBytes, verifySePayIpn } from "./ipn";

const secret = "staging-only-test-secret";
const timestamp = 1_800_000_000;
const payload = JSON.stringify({
  accountNumber: "SANITIZED-TEST",
  code: "WEB-TEST001",
  content: "WEB-TEST001 sanitized staging payment",
  gateway: "TestBank",
  id: 12345,
  referenceCode: "TEST-TRANSACTION-001",
  transferAmount: 125000,
  transferType: "in",
});
const expected = {
  amount: 125000,
  currency: "VND" as const,
  environment: "sandbox" as const,
  merchantReference: "WEB-TEST001",
};

function signature(rawBody = payload, signingTimestamp = timestamp): string {
  return `sha256=${createHmac("sha256", secret)
    .update(`${signingTimestamp}.${rawBody}`)
    .digest("hex")}`;
}

function verify(patch: Partial<Parameters<typeof verifySePayIpn>[0]> = {}) {
  return verifySePayIpn({
    expected,
    nowSeconds: timestamp,
    rawBody: payload,
    secret,
    signature: signature(),
    timestamp: String(timestamp),
    ...patch,
  });
}

describe("verifySePayIpn", () => {
  it("verifies timestamp plus exact raw body before matching sandbox payment truth", () => {
    expect(verify()).toEqual({
      evidence: expect.objectContaining({
        amount: 125000,
        currency: "VND",
        merchantReference: "WEB-TEST001",
        providerTransactionId: "TEST-TRANSACTION-001",
      }),
      kind: "verified",
      payloadDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      providerEventId: "12345",
      providerTransactionId: "TEST-TRANSACTION-001",
    });
  });

  it.each([
    ["missing signature", { signature: null }, "missing_signature"],
    ["missing timestamp", { timestamp: null }, "missing_timestamp"],
    ["malformed timestamp", { timestamp: "not-a-timestamp" }, "invalid_timestamp"],
    ["stale timestamp", { nowSeconds: timestamp + 301 }, "expired_timestamp"],
    ["wrong signature", { signature: "sha256=".concat("0".repeat(64)) }, "invalid_signature"],
    ["missing secret", { secret: undefined }, "configuration_missing"],
  ])("rejects %s before trusting payload", (_name, patch, reason) => {
    expect(verify(patch)).toEqual({ kind: "rejected", reason });
  });

  it("rejects any raw-body alteration even when parsed JSON would be equivalent", () => {
    const altered = `${payload} `;
    expect(verify({ rawBody: altered })).toEqual({
      kind: "rejected",
      reason: "invalid_signature",
    });
  });

  it.each([
    ["wrong amount", { ...expected, amount: 1 }],
    ["wrong reference", { ...expected, merchantReference: "WEB-OTHER" }],
  ])("rejects %s after authentication", (_name, mismatchedExpected) => {
    expect(verify({ expected: mismatchedExpected })).toEqual({
      kind: "rejected",
      reason: "payment_mismatch",
    });
  });

  it.each([
    ["outbound direction", payload.replace('"in"', '"out"')],
    ["fractional VND", payload.replace("125000", "125000.5")],
    ["missing payment code", payload.replace('"WEB-TEST001"', '""')],
  ])("rejects malformed or unsafe payload: %s", (_name, rawBody) => {
    expect(verify({
      rawBody,
      signature: signature(rawBody),
    })).toEqual({ kind: "rejected", reason: "invalid_payload" });
  });

  it("rejects an oversized body before parsing", () => {
    expect(verify({
      rawBody: "x".repeat(maximumSePayIpnBodyBytes + 1),
      signature: signature("x".repeat(maximumSePayIpnBodyBytes + 1)),
    })).toEqual({ kind: "rejected", reason: "body_too_large" });
  });
});
