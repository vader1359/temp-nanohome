import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AccountCheckoutRepositoryError,
  createAccountCheckoutRepository,
} from "./account-checkout-repository.server";

const baseUrl = "https://xtjmwpeqarmsumjspnyw.supabase.co";
const projectRef = "xtjmwpeqarmsumjspnyw";
const input = {
  address: "1 Test Street",
  email: "customer@example.test",
  fullName: "Test Customer",
  idempotencyKey: "00000000-0000-4000-8000-000000000201",
  phone: "0900000000",
};

describe("AccountCheckoutRepository", () => {
  it("rejects non-staging remote hosts", () => {
    expect(() => createAccountCheckoutRepository({
      baseUrl: "https://production-project.supabase.co",
      projectRef,
      mutationsEnabled: false,
      serviceRoleKey: "not-printed",
    })).toThrowError(expect.objectContaining({ code: "invalid_environment" }));
  });

  it("fails before network I/O when mutations are disabled", async () => {
    const fetcher = vi.fn();
    const repository = createAccountCheckoutRepository({
      baseUrl,
      fetcher: fetcher as unknown as typeof fetch,
      projectRef,
      mutationsEnabled: false,
      serviceRoleKey: "not-printed",
    });
    await expect(repository.captureOrder("account-owned", input))
      .rejects.toMatchObject({ code: "mutation_disabled" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("passes exact account, delivery, idempotency, and a server digest to the capture RPC", async () => {
    let body: Record<string, unknown> | undefined;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return jsonResponse([{
        amount: "125000",
        currency: "VND",
        merchant_reference: "WEB-TEST001",
        order_id: "00000000-0000-4000-8000-000000000301",
        order_number: "ORD-TEST001",
        replayed: false,
      }]);
    });
    const repository = createAccountCheckoutRepository({
      baseUrl,
      fetcher: fetcher as unknown as typeof fetch,
      projectRef,
      mutationsEnabled: true,
      serviceRoleKey: "not-printed",
    });

    await expect(repository.captureOrder("account-owned", input)).resolves.toEqual({
      amount: 125000,
      currency: "VND",
      merchantReference: "WEB-TEST001",
      orderId: "00000000-0000-4000-8000-000000000301",
      orderNumber: "ORD-TEST001",
      replayed: false,
    });
    expect(body).toMatchObject({
      p_account_id: "account-owned",
      p_address: "1 Test Street",
      p_email: "customer@example.test",
      p_full_name: "Test Customer",
      p_idempotency_key: input.idempotencyKey,
      p_phone: "0900000000",
      p_request_digest: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(body).not.toHaveProperty("amount");
    expect(body).not.toHaveProperty("payment_status");
  });

  it("maps only known SQL contract errors and hides unknown database details", async () => {
    const known = createAccountCheckoutRepository({
      baseUrl,
      fetcher: vi.fn(async () => jsonResponse({ message: "checkout_invalid_cart" }, 400)) as unknown as typeof fetch,
      projectRef,
      mutationsEnabled: true,
      serviceRoleKey: "not-printed",
    });
    await expect(known.captureOrder("account-owned", input))
      .rejects.toMatchObject({ code: "checkout_invalid_cart" });

    const unknown = createAccountCheckoutRepository({
      baseUrl,
      fetcher: vi.fn(async () => jsonResponse({ message: "sensitive database detail" }, 500)) as unknown as typeof fetch,
      projectRef,
      mutationsEnabled: true,
      serviceRoleKey: "not-printed",
    });
    await expect(unknown.captureOrder("account-owned", input))
      .rejects.toEqual(new AccountCheckoutRepositoryError("request_failed"));
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}
