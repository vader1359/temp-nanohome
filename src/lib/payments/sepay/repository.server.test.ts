import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createSePayTestRepository,
  SePayTestRepositoryError,
} from "./repository.server";

const baseUrl = "https://xtjmwpeqarmsumjspnyw.supabase.co";
const projectRef = "xtjmwpeqarmsumjspnyw";
const orderId = "00000000-0000-4000-8000-000000000301";

describe("SePayTestRepository", () => {
  it("rejects non-staging remote hosts", () => {
    expect(() => createSePayTestRepository({
      baseUrl: "https://production-project.supabase.co",
      projectRef,
      mutationsEnabled: false,
      serviceRoleKey: "not-printed",
    })).toThrowError(expect.objectContaining({ code: "invalid_environment" }));
  });

  it("blocks payment writes before network I/O when sandbox mutations are disabled", async () => {
    const fetcher = vi.fn();
    const repository = createSePayTestRepository({
      baseUrl,
      fetcher: fetcher as unknown as typeof fetch,
      projectRef,
      mutationsEnabled: false,
      serviceRoleKey: "not-printed",
    });
    await expect(repository.createAttempt("account-owned", orderId, "00000000-0000-4000-8000-000000000302"))
      .rejects.toEqual(new SePayTestRepositoryError("mutation_disabled"));
    await expect(repository.applyVerifiedIpn({
      amount: 125000,
      merchantReference: "WEB0123456789AB",
      payloadDigest: "a".repeat(64),
      providerEventId: "event-1",
      providerTransactionId: "transaction-1",
      receivedAt: new Date("2026-07-28T00:00:00.000Z"),
    })).rejects.toMatchObject({ code: "mutation_disabled" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("creates one exact-account sandbox attempt without browser amount or payment state", async () => {
    let url: URL | undefined;
    let body: unknown;
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      url = new URL(String(input));
      body = JSON.parse(String(init?.body));
      return jsonResponse([{
        amount: "125000",
        attempt_id: "00000000-0000-4000-8000-000000000401",
        attempt_state: "pending",
        created: true,
        currency: "VND",
        expires_at: "2026-07-29T00:00:00.000Z",
        merchant_reference: "WEB0123456789AB",
        provider_checkout_url: "https://vietqr.app/img",
        provider_order_id: "WEB0123456789AB",
      }]);
    });
    const repository = createSePayTestRepository({
      baseUrl,
      fetcher: fetcher as unknown as typeof fetch,
      projectRef,
      mutationsEnabled: true,
      serviceRoleKey: "not-printed",
    });

    await expect(repository.createAttempt(
      "account-owned",
      orderId,
      "00000000-0000-4000-8000-000000000302",
    )).resolves.toEqual({
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
    expect(url?.pathname).toBe("/rest/v1/rpc/create_customer_sepay_test_attempt");
    expect(body).toEqual({
      p_account_id: "account-owned",
      p_idempotency_key: "00000000-0000-4000-8000-000000000302",
      p_order_id: orderId,
    });
  });

  it("resolves expected payment only through the sandbox attempt boundary", async () => {
    let url: URL | undefined;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      url = new URL(String(input));
      return jsonResponse([{
        amount: 125000,
        currency: "VND",
        merchant_reference: "WEB0123456789AB",
        provider_environment: "sandbox",
        state: "pending",
      }]);
    });
    const repository = createSePayTestRepository({
      baseUrl,
      fetcher: fetcher as unknown as typeof fetch,
      projectRef,
      mutationsEnabled: true,
      serviceRoleKey: "not-printed",
    });

    await expect(repository.getExpectedPayment("WEB0123456789AB")).resolves.toEqual({
      amount: 125000,
      currency: "VND",
      environment: "sandbox",
      merchantReference: "WEB0123456789AB",
      state: "pending",
    });
    expect(url?.searchParams.get("provider")).toBe("eq.sepay");
    expect(url?.searchParams.get("provider_environment")).toBe("eq.sandbox");
    expect(url?.searchParams.get("merchant_reference")).toBe("eq.WEB0123456789AB");
  });

  it("applies digest-only verified evidence and never sends a raw provider payload", async () => {
    let body: Record<string, unknown> | undefined;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return jsonResponse("applied");
    });
    const repository = createSePayTestRepository({
      baseUrl,
      fetcher: fetcher as unknown as typeof fetch,
      projectRef,
      mutationsEnabled: true,
      serviceRoleKey: "not-printed",
    });

    await expect(repository.applyVerifiedIpn({
      amount: 125000,
      merchantReference: "WEB0123456789AB",
      payloadDigest: "b".repeat(64),
      providerEventId: "event-1",
      providerTransactionId: "transaction-1",
      receivedAt: new Date("2026-07-28T00:00:00.000Z"),
    })).resolves.toBe("applied");
    expect(body).toEqual({
      p_amount: 125000,
      p_merchant_reference: "WEB0123456789AB",
      p_payload_digest: "b".repeat(64),
      p_provider_event_id: "event-1",
      p_provider_transaction_id: "transaction-1",
      p_received_at: "2026-07-28T00:00:00.000Z",
    });
    expect(body).not.toHaveProperty("rawBody");
    expect(body).not.toHaveProperty("payload");
  });

  it("reads payment status with exact account ownership and no delivery PII", async () => {
    const calls: URL[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(url);
      return calls.length === 1
        ? jsonResponse([{
            id: orderId,
            payment_status: "unpaid",
            updated_at: "2026-07-28T00:00:00.000Z",
            web_order_number: "WEB-TEST001",
          }])
        : jsonResponse([{ state: "pending" }]);
    });
    const repository = createSePayTestRepository({
      baseUrl,
      fetcher: fetcher as unknown as typeof fetch,
      projectRef,
      mutationsEnabled: false,
      serviceRoleKey: "not-printed",
    });

    await expect(repository.getPaymentStatus("account-owned", orderId)).resolves.toEqual({
      orderId,
      orderNumber: "WEB-TEST001",
      paymentState: "pending",
      updatedAt: "2026-07-28T00:00:00.000Z",
    });
    expect(calls[0]?.searchParams.get("account_id")).toBe("eq.account-owned");
    expect(calls[0]?.searchParams.get("id")).toBe(`eq.${orderId}`);
    expect(calls[0]?.searchParams.get("select")).not.toMatch(/email|phone|address|note/);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}
