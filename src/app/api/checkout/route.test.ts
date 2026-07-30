import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  captureOrder: vi.fn(),
  getAuthenticatedAccount: vi.fn(),
}));
vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: mocks.getAuthenticatedAccount }),
}));
vi.mock("@/lib/checkout/account-checkout-runtime.server", () => ({
  getAccountCheckoutRepository: () => ({ captureOrder: mocks.captureOrder }),
}));

import { AccountCheckoutRepositoryError } from "@/lib/checkout/account-checkout-repository.server";
import { POST } from "./route";

const account = {
  accountId: "account-owned",
  firebaseUid: "firebase-owned",
  identities: [
    { identifier: "Customer@Example.test", provider: "email", verified: true },
    { identifier: "+84 901 234 567", provider: "phone", verified: true },
  ],
  locale: "vi",
} as const;
const idempotencyKey = "00000000-0000-4000-8000-000000000201";
const validBody = {
  idempotencyKey,
  delivery: {
    address: "1 Test Street",
    addressId: null,
    fullName: "Test Customer",
  },
  vat: null,
};

function request(body: unknown, origin = "https://staging.nanohome.vn"): Request {
  return new Request("https://staging.nanohome.vn/api/checkout", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin },
    method: "POST",
  });
}

describe("POST /api/checkout", () => {
  beforeEach(() => {
    mocks.captureOrder.mockReset();
    mocks.getAuthenticatedAccount.mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it("rejects cross-origin and anonymous requests before order capture", async () => {
    const forbidden = await POST(request(validBody, "https://attacker.test"));
    expect(forbidden.status).toBe(403);
    expect(mocks.getAuthenticatedAccount).not.toHaveBeenCalled();

    mocks.getAuthenticatedAccount.mockResolvedValue(null);
    const unauthorized = await POST(request(validBody));
    expect(unauthorized.status).toBe(401);
    expect(mocks.captureOrder).not.toHaveBeenCalled();
  });

  it("captures only validated delivery data for the server-resolved Firebase account", async () => {
    mocks.getAuthenticatedAccount.mockResolvedValue(account);
    mocks.captureOrder.mockResolvedValue({
      amount: 125000,
      currency: "VND",
      merchantReference: "WEB-TEST001",
      orderId: "00000000-0000-4000-8000-000000000301",
      orderNumber: "ORD-TEST001",
      replayed: false,
    });

    const response = await POST(request(validBody));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      next: "initialize_payment",
      orderId: "00000000-0000-4000-8000-000000000301",
      orderNumber: "ORD-TEST001",
      replayed: false,
    });
    expect(mocks.captureOrder).toHaveBeenCalledWith(account.accountId, expect.objectContaining({
      address: "1 Test Street",
      fullName: "Test Customer",
      idempotencyKey,
      email: "customer@example.test",
      phone: "+84901234567",
    }));
  });

  it("requires both verified email and normalized E.164 phone before capture", async () => {
    mocks.getAuthenticatedAccount.mockResolvedValue({
      ...account,
      identities: [{ identifier: "Customer@Example.test", provider: "email", verified: true }],
    });

    const response = await POST(request(validBody));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "identity_required",
      missing: ["phone"],
      returnTo: "/vi/checkout",
    });
    expect(mocks.captureOrder).not.toHaveBeenCalled();
  });

  it("rejects browser cart, price, state, and owner fields at the boundary", async () => {
    mocks.getAuthenticatedAccount.mockResolvedValue(account);
    const response = await POST(request({
      ...validBody,
      accountId: "account-other",
      email: "attacker@example.test",
      paymentStatus: "paid",
      phone: "+84900000000",
      total: 1,
    }));
    expect(response.status).toBe(400);
    expect(mocks.captureOrder).not.toHaveBeenCalled();
  });

  it("returns stable replay and invalid-cart outcomes", async () => {
    mocks.getAuthenticatedAccount.mockResolvedValue(account);
    mocks.captureOrder
      .mockResolvedValueOnce({
        amount: 125000,
        currency: "VND",
        merchantReference: "WEB-TEST001",
        orderId: "00000000-0000-4000-8000-000000000301",
        orderNumber: "ORD-TEST001",
        replayed: true,
      })
      .mockRejectedValueOnce(new AccountCheckoutRepositoryError("checkout_invalid_cart"));

    expect((await POST(request(validBody))).status).toBe(200);
    expect((await POST(request(validBody))).status).toBe(409);
  });

  it("fails closed when local/staging account mutations are disabled", async () => {
    mocks.getAuthenticatedAccount.mockResolvedValue(account);
    mocks.captureOrder.mockRejectedValue(new AccountCheckoutRepositoryError("mutation_disabled"));
    const response = await POST(request(validBody));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "checkout_disabled" });
  });
});
