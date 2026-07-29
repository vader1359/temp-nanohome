import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createAttempt: vi.fn(),
  enabled: vi.fn(),
  getAuthenticatedAccount: vi.fn(),
}));
vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: mocks.getAuthenticatedAccount }),
}));
vi.mock("@/lib/payments/sepay/runtime.server", () => ({
  getSePayTestRepository: () => ({ createAttempt: mocks.createAttempt }),
  isSePaySandboxRuntimeEnabled: () => mocks.enabled(),
}));

import { POST } from "./route";

const orderId = "00000000-0000-4000-8000-000000000301";
const account = {
  accountId: "account-owned",
  firebaseUid: "firebase-owned",
  identities: [],
  locale: "vi",
} as const;

function request(origin = "https://staging.nanohome.vn"): Request {
  return new Request(
    `https://staging.nanohome.vn/api/orders/${orderId}/payments/sepay`,
    { headers: { origin }, method: "POST" },
  );
}

describe("SePay Test payment initiation route", () => {
  beforeEach(() => {
    mocks.createAttempt.mockReset();
    mocks.enabled.mockReset();
    mocks.getAuthenticatedAccount.mockReset();
    mocks.enabled.mockReturnValue(true);
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
      merchantReference: "WEB-TEST001",
      state: "pending",
    });

    const response = await POST(request(), {
      params: Promise.resolve({ orderId }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      payment: {
        amount: 125000,
        currency: "VND",
        environment: "sandbox",
        merchantReference: "WEB-TEST001",
        paymentState: "pending",
      },
    });
    expect(mocks.createAttempt).toHaveBeenCalledWith(account.accountId, orderId);
  });

  it("returns an existing attempt idempotently and rejects invalid IDs", async () => {
    mocks.getAuthenticatedAccount.mockResolvedValue(account);
    mocks.createAttempt.mockResolvedValue({
      amount: 125000,
      attemptId: "00000000-0000-4000-8000-000000000401",
      created: false,
      currency: "VND",
      merchantReference: "WEB-TEST001",
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
