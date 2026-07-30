import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  applyVerifiedIpn: vi.fn(),
  enabled: vi.fn(),
  getExpectedPayment: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  env: { SEPAY_WEBHOOK_HMAC_SECRET: "route-test-secret" },
}));
vi.mock("@/lib/payments/sepay/runtime.server", () => ({
  getSePayTestRepository: () => ({
    applyVerifiedIpn: mocks.applyVerifiedIpn,
    getExpectedPayment: mocks.getExpectedPayment,
  }),
  isSePaySandboxRuntimeEnabled: () => mocks.enabled(),
}));

import { POST } from "./route";

const rawBody = JSON.stringify({
  accountNumber: "SANITIZED-TEST",
  code: "WEB0123456789AB",
  content: "WEB0123456789AB sanitized staging payment",
  gateway: "TestBank",
  id: 12345,
  referenceCode: "TEST-TRANSACTION-001",
  transferAmount: 125000,
  transferType: "in",
});

function request(
  body = rawBody,
  signatureSecret = "route-test-secret",
  timestamp = Math.floor(Date.now() / 1000),
): Request {
  const signature = `sha256=${createHmac("sha256", signatureSecret)
    .update(`${timestamp}.${body}`)
    .digest("hex")}`;
  return new Request("https://staging.nanohome.vn/api/payments/sepay/ipn", {
    body,
    headers: {
      "content-type": "application/json",
      "x-sepay-signature": signature,
      "x-sepay-timestamp": String(timestamp),
    },
    method: "POST",
  });
}

describe("SePay Test IPN route", () => {
  beforeEach(() => {
    mocks.applyVerifiedIpn.mockReset();
    mocks.enabled.mockReset();
    mocks.getExpectedPayment.mockReset();
    mocks.enabled.mockReturnValue(true);
    mocks.getExpectedPayment.mockResolvedValue({
      amount: 125000,
      currency: "VND",
      environment: "sandbox",
      merchantReference: "WEB0123456789AB",
      state: "pending",
    });
  });

  it("returns 201 for first verified apply and 200 for durable duplicate", async () => {
    mocks.applyVerifiedIpn
      .mockResolvedValueOnce("applied")
      .mockResolvedValueOnce("duplicate");

    const accepted = await POST(request());
    expect(accepted.status).toBe(201);
    await expect(accepted.json()).resolves.toEqual({ success: true });
    expect(mocks.applyVerifiedIpn).toHaveBeenCalledWith(expect.objectContaining({
      amount: 125000,
      merchantReference: "WEB0123456789AB",
      payloadDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      providerEventId: "12345",
      providerTransactionId: "TEST-TRANSACTION-001",
    }));
    expect(mocks.applyVerifiedIpn.mock.calls[0]?.[0]).not.toHaveProperty("rawBody");

    const duplicate = await POST(request());
    expect(duplicate.status).toBe(200);
    await expect(duplicate.json()).resolves.toEqual({ success: true });
  });

  it("rejects invalid authentication before repository lookup", async () => {
    const invalid = await POST(request(rawBody, "wrong-secret"));
    expect(invalid.status).toBe(401);
    expect(mocks.getExpectedPayment).not.toHaveBeenCalled();
    expect(mocks.applyVerifiedIpn).not.toHaveBeenCalled();
  });

  it("rejects wrong amount, direction, reference, and unknown attempts", async () => {
    mocks.getExpectedPayment.mockResolvedValueOnce({
      amount: 1,
      currency: "VND",
      environment: "sandbox",
      merchantReference: "WEB0123456789AB",
      state: "pending",
    });
    expect((await POST(request())).status).toBe(400);
    expect(mocks.applyVerifiedIpn).not.toHaveBeenCalled();

    const outbound = rawBody.replace('"in"', '"out"');
    expect((await POST(request(outbound))).status).toBe(400);

    mocks.getExpectedPayment.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(400);
  });

  it("fails closed when sandbox runtime is disabled or ledger reports conflict", async () => {
    mocks.enabled.mockReturnValueOnce(false);
    expect((await POST(request())).status).toBe(503);
    expect(mocks.getExpectedPayment).not.toHaveBeenCalled();

    mocks.applyVerifiedIpn.mockResolvedValue("conflict");
    expect((await POST(request())).status).toBe(409);
  });
});
