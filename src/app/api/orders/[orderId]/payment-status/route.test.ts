import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getAuthenticatedAccount: vi.fn(),
  getPaymentStatus: vi.fn(),
}));
vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: mocks.getAuthenticatedAccount }),
}));
vi.mock("@/lib/payments/sepay/runtime.server", () => ({
  getSePayTestRepository: () => ({ getPaymentStatus: mocks.getPaymentStatus }),
}));

import { GET } from "./route";

const orderId = "00000000-0000-4000-8000-000000000301";
const account = {
  accountId: "account-owned",
  firebaseUid: "firebase-owned",
  identities: [],
  locale: "vi",
} as const;

describe("account-owned payment status route", () => {
  beforeEach(() => {
    mocks.getAuthenticatedAccount.mockReset();
    mocks.getPaymentStatus.mockReset();
  });

  it("rejects anonymous reads and foreign/missing order IDs", async () => {
    mocks.getAuthenticatedAccount.mockResolvedValueOnce(null);
    expect((await GET(new Request("https://staging.nanohome.vn"), {
      params: Promise.resolve({ orderId }),
    })).status).toBe(401);

    mocks.getAuthenticatedAccount.mockResolvedValueOnce(account);
    mocks.getPaymentStatus.mockResolvedValue(null);
    expect((await GET(new Request("https://staging.nanohome.vn"), {
      params: Promise.resolve({ orderId }),
    })).status).toBe(404);
    expect(mocks.getPaymentStatus).toHaveBeenCalledWith(account.accountId, orderId);
  });

  it("returns server payment truth without accepting redirect parameters", async () => {
    mocks.getAuthenticatedAccount.mockResolvedValue(account);
    mocks.getPaymentStatus.mockResolvedValue({
      orderId,
      orderNumber: "WEB-TEST001",
      paymentState: "paid",
      updatedAt: "2026-07-28T00:00:00.000Z",
    });
    const response = await GET(new Request(
      "https://staging.nanohome.vn?paymentState=paid&accountId=other",
    ), { params: Promise.resolve({ orderId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      orderId,
      orderNumber: "WEB-TEST001",
      paymentState: "paid",
      updatedAt: "2026-07-28T00:00:00.000Z",
    });
    expect(mocks.getPaymentStatus).toHaveBeenCalledWith(account.accountId, orderId);
  });
});
