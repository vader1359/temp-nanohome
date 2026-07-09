import { afterEach, describe, expect, it, vi } from "vitest";

const checkoutMocks = vi.hoisted(() => ({
  captureOrderFromCart: vi.fn(),
  createCheckoutClient: vi.fn(),
}));

vi.mock("@/lib/checkout/capture-order", () => ({
  captureOrderFromCart: checkoutMocks.captureOrderFromCart,
}));

vi.mock("@/lib/supabase/checkout", () => ({
  createCheckoutClient: checkoutMocks.createCheckoutClient,
}));

afterEach(() => {
  checkoutMocks.captureOrderFromCart.mockReset();
  checkoutMocks.createCheckoutClient.mockReset();
});

describe("POST /api/checkout", () => {
  it("returns the server-created order reference for an authenticated delivery request", async () => {
    // Given: an authenticated session and a successful persisted-cart capture.
    checkoutMocks.createCheckoutClient.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })) },
      rpc: vi.fn(),
    });
    checkoutMocks.captureOrderFromCart.mockResolvedValue({
      kind: "success",
      orderId: "order-1",
      orderNumber: "ORD-opaque",
    });
    const { POST } = await import("./route");

    // When: the client sends only contact and delivery details.
    const response = await POST(new Request("https://example.test/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Nguyen Van A",
        email: "customer@example.com",
        phone: "0900000000",
        address: "1 Nguyen Hue",
        city: "Ho Chi Minh City",
        note: "Call before delivery",
      }),
    }));

    // Then: the RPC receives no user, cart, price, status, or order fields from the client.
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ orderId: "order-1", orderNumber: "ORD-opaque" });
    expect(checkoutMocks.captureOrderFromCart).toHaveBeenCalledWith(
      expect.anything(),
      {
        fullName: "Nguyen Van A",
        email: "customer@example.com",
        phone: "0900000000",
        address: "1 Nguyen Hue",
        city: "Ho Chi Minh City",
        note: "Call before delivery",
      },
    );
  });

  it("rejects malformed JSON and unrecognized checkout fields", async () => {
    // Given: a route with no need to reach authentication for malformed payloads.
    const { POST } = await import("./route");

    // When: malformed JSON or a client-controlled cart field is submitted.
    const malformedResponse = await POST(new Request("https://example.test/api/checkout", { method: "POST", body: "{" }));
    const extraFieldResponse = await POST(new Request("https://example.test/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Nguyen Van A",
        email: "customer@example.com",
        phone: "0900000000",
        address: "1 Nguyen Hue",
        cartId: "attacker-cart",
      }),
    }));

    // Then: both requests are rejected before the checkout RPC can run.
    expect(malformedResponse.status).toBe(400);
    expect(extraFieldResponse.status).toBe(400);
    expect(checkoutMocks.createCheckoutClient).not.toHaveBeenCalled();
    expect(checkoutMocks.captureOrderFromCart).not.toHaveBeenCalled();
  });

  it("rejects missing authentication and database-declared cart failures", async () => {
    // Given: one unauthenticated session followed by an authenticated invalid-cart result.
    checkoutMocks.createCheckoutClient
      .mockResolvedValueOnce({ auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) }, rpc: vi.fn() })
      .mockResolvedValueOnce({
        auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })) },
        rpc: vi.fn(),
      });
    checkoutMocks.captureOrderFromCart.mockResolvedValue({ kind: "invalid_cart" });
    const { POST } = await import("./route");
    const request = () => new Request("https://example.test/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Nguyen Van A",
        email: "customer@example.com",
        phone: "0900000000",
        address: "1 Nguyen Hue",
      }),
    });

    // When: each session attempts checkout.
    const unauthorizedResponse = await POST(request());
    const invalidCartResponse = await POST(request());

    // Then: authentication and database-declared failures have deterministic HTTP responses.
    expect(unauthorizedResponse.status).toBe(401);
    expect(invalidCartResponse.status).toBe(409);
  });
});
