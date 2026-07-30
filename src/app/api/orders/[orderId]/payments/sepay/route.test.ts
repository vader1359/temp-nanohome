import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createAttempt: vi.fn(),
  createVietQr: vi.fn(),
  enabled: vi.fn(),
  getAuthenticatedAccount: vi.fn(),
}));
vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: mocks.getAuthenticatedAccount }),
}));
vi.mock("@/lib/payments/sepay/runtime.server", () => ({
  getSePayTestModeRuntimeConfig: () => ({
    apiBaseUrl: "https://userapi-sandbox.sepay.vn/v2",
    apiToken: "test-mode-api-token",
    bankAccountId: "00000000-0000-4000-8000-000000000701",
  }),
  getSePayTestRepository: () => ({ createAttempt: mocks.createAttempt }),
  isSePaySandboxRuntimeEnabled: () => mocks.enabled(),
}));
vi.mock("@/lib/payments/sepay/test-mode-client.server", () => ({
  createSePayTestModeVietQr: mocks.createVietQr,
  SEPAY_TEST_VIETQR_URL: "https://vietqr.app/img",
}));

import { POST } from "./route";

const orderId = "00000000-0000-4000-8000-000000000301";
const idempotencyKey = "00000000-0000-4000-8000-000000000302";
const account = {
  accountId: "account-owned",
  firebaseUid: "firebase-owned",
  identities: [],
  locale: "vi",
} as const;

function request(origin = "https://staging.nanohome.vn"): Request {
  return new Request(
    `https://staging.nanohome.vn/api/orders/${orderId}/payments/sepay`,
    {
      body: JSON.stringify({ idempotencyKey, returnUrlsVersion: "v1" }),
      headers: { "content-type": "application/json", origin },
      method: "POST",
    },
  );
}

describe("SePay Test payment initiation route", () => {
  beforeEach(() => {
    mocks.createAttempt.mockReset();
    mocks.createVietQr.mockReset();
    mocks.enabled.mockReset();
    mocks.getAuthenticatedAccount.mockReset();
    mocks.enabled.mockReturnValue(true);
    mocks.createVietQr.mockResolvedValue({
      paymentUrl: "https://vietqr.app/img?acc=SBSEPAYTESTVA000001&bank=VCB&amount=125000&des=WEB0123456789AB&template=compact&showinfo=true&fullacc=true",
    });
  });

  it("rejects cross-origin, anonymous, and disabled payment initiation", async () => {
    expect((await POST(request("https://attacker.test"), {
      params: Promise.resolve({ orderId }),
    })).status).toBe(403);
    expect(mocks.getAuthenticatedAccount).not.toHaveBeenCalled();

    mocks.getAuthenticatedAccount.mockResolvedValueOnce(null);
    expect((await POST(request(), {
      params: Promise.resolve({ orderId }),
    })).status).toBe(401);

    mocks.getAuthenticatedAccount.mockResolvedValueOnce(account);
    mocks.enabled.mockReturnValue(false);
    expect((await POST(request(), {
      params: Promise.resolve({ orderId }),
    })).status).toBe(503);
    expect(mocks.createAttempt).not.toHaveBeenCalled();
  });

  it("returns only a sandbox pending instruction from an exact-account attempt", async () => {
    mocks.getAuthenticatedAccount.mockResolvedValue(account);
    mocks.createAttempt.mockResolvedValue({
      amount: 125000,
      attemptId: "00000000-0000-4000-8000-000000000401",
      created: true,
      currency: "VND",
      expiresAt: "2026-07-29T00:00:00.000Z",
      merchantReference: "WEB0123456789AB",
      providerCheckoutUrl: "https://vietqr.app/img",
      providerOrderId: "WEB0123456789AB",
      state: "pending",
    });

    const response = await POST(request(), {
      params: Promise.resolve({ orderId }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      payment: expect.objectContaining({
        amount: 125000,
        attemptId: "00000000-0000-4000-8000-000000000401",
        currency: "VND",
        environment: "sandbox",
        expiresAt: "2026-07-29T00:00:00.000Z",
        handoff: "vietqr",
        merchantReference: "WEB0123456789AB",
        paymentUrl: expect.stringMatching(/^https:\/\/vietqr\.app\/img\?/u),
        state: "pending",
      }),
    });
    expect(mocks.createAttempt).toHaveBeenCalledWith(account.accountId, orderId, idempotencyKey);
    expect(mocks.createVietQr).toHaveBeenCalledWith({
      amount: 125000,
      apiBaseUrl: "https://userapi-sandbox.sepay.vn/v2",
      apiToken: "test-mode-api-token",
      bankAccountId: "00000000-0000-4000-8000-000000000701",
      merchantReference: "WEB0123456789AB",
    });
  });

  it("returns an existing attempt idempotently and rejects invalid IDs", async () => {
    mocks.getAuthenticatedAccount.mockResolvedValue(account);
    mocks.createAttempt.mockResolvedValue({
      amount: 125000,
      attemptId: "00000000-0000-4000-8000-000000000401",
      created: false,
      currency: "VND",
      expiresAt: "2026-07-29T00:00:00.000Z",
      merchantReference: "WEB0123456789AB",
      providerCheckoutUrl: "https://vietqr.app/img",
      providerOrderId: "WEB0123456789AB",
      state: "pending",
    });
    expect((await POST(request(), {
      params: Promise.resolve({ orderId }),
    })).status).toBe(200);

    expect((await POST(request(), {
      params: Promise.resolve({ orderId: "not-an-order-id" }),
    })).status).toBe(404);
    expect(mocks.createAttempt).toHaveBeenCalledTimes(1);
  });
});
