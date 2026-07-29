import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AccountDataRepositoryError,
  createAccountDataRepository,
} from "./account-data-repository.server";

const baseUrl = "https://xtjmwpeqarmsumjspnyw.supabase.co";
const projectRef = "xtjmwpeqarmsumjspnyw";

describe("createAccountDataRepository", () => {
  it("rejects any Supabase project outside the confirmed staging host", () => {
    expect(() => createAccountDataRepository({
      baseUrl: "https://production-project.supabase.co",
      projectRef,
      mutationsEnabled: false,
      serviceRoleKey: "not-printed",
    })).toThrowError(expect.objectContaining({ code: "invalid_environment" }));
  });

  it("resolves only an active account from an exact active Firebase UID mapping", async () => {
    const calls: URL[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(url);
      return jsonResponse(calls.length === 1
        ? [{ account_id: "account-owned" }]
        : [{ id: "account-owned" }]);
    });
    const repository = createAccountDataRepository({
      baseUrl,
      fetcher: fetcher as unknown as typeof fetch,
      projectRef,
      mutationsEnabled: false,
      serviceRoleKey: "not-printed",
    });

    await expect(repository.resolveAccountId("firebase-owned")).resolves.toBe("account-owned");
    expect(calls[0]?.pathname).toBe("/rest/v1/customer_firebase_principals");
    expect(calls[0]?.searchParams.get("firebase_uid")).toBe("eq.firebase-owned");
    expect(calls[0]?.searchParams.get("status")).toBe("eq.active");
    expect(calls[1]?.pathname).toBe("/rest/v1/customer_accounts");
    expect(calls[1]?.searchParams.get("id")).toBe("eq.account-owned");
    expect(calls[1]?.searchParams.get("state")).toBe("eq.active");
  });

  it("fails closed before network I/O when account mutations are disabled", async () => {
    const fetcher = vi.fn();
    const repository = createAccountDataRepository({
      baseUrl,
      fetcher: fetcher as unknown as typeof fetch,
      projectRef,
      mutationsEnabled: false,
      serviceRoleKey: "not-printed",
    });

    await expect(repository.patchProfile("account-owned", { fullName: "An" }))
      .rejects.toBeInstanceOf(AccountDataRepositoryError);
    await expect(repository.removeWishlistItem("account-owned", "variant-owned"))
      .rejects.toMatchObject({ code: "mutation_disabled" });
    await expect(repository.mutateCart("account-owned", {
      expectedVersion: 0,
      operation: "add",
      quantity: 1,
      variantId: "00000000-0000-4000-8000-000000000001",
    })).rejects.toMatchObject({ code: "mutation_disabled" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("scopes a profile upsert to the server-resolved account ID", async () => {
    const calls: Array<Readonly<{ body: unknown; url: URL }>> = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        body: JSON.parse(String(init?.body)),
        url: new URL(String(input)),
      });
      return jsonResponse([{
        date_of_birth: null,
        form_of_address: null,
        full_name: "An Nguyễn",
        nationality: null,
        preferred_locale: "vi",
      }]);
    });
    const repository = createAccountDataRepository({
      baseUrl,
      fetcher: fetcher as unknown as typeof fetch,
      projectRef,
      mutationsEnabled: true,
      serviceRoleKey: "not-printed",
    });

    await expect(repository.patchProfile("account-owned", { fullName: "An Nguyễn" }))
      .resolves.toMatchObject({ fullName: "An Nguyễn" });
    expect(calls[0]?.url.pathname).toBe("/rest/v1/customer_account_profiles");
    expect(calls[0]?.url.searchParams.get("on_conflict")).toBe("account_id");
    expect(calls[0]?.body).toEqual({
      account_id: "account-owned",
      full_name: "An Nguyễn",
    });
  });

  it("reads order history with an exact owner filter and excludes delivery PII", async () => {
    const calls: URL[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(url);
      return jsonResponse([{
        business_status: "created",
        created_at: "2026-07-28T00:00:00.000Z",
        currency: "VND",
        fulfillment_status: "unfulfilled",
        grand_total: 125000,
        id: "order-owned",
        order_items: [],
        payment_status: "unpaid",
        refund_status: "none",
        web_order_number: "WEB-OWNED",
      }]);
    });
    const repository = createAccountDataRepository({
      baseUrl,
      fetcher: fetcher as unknown as typeof fetch,
      projectRef,
      mutationsEnabled: false,
      serviceRoleKey: "not-printed",
    });

    await expect(repository.getOrder("account-owned", "order-owned")).resolves.toMatchObject({
      orderId: "order-owned",
      paymentStatus: "unpaid",
    });
    const query = calls[0]?.searchParams;
    expect(query?.get("account_id")).toBe("eq.account-owned");
    expect(query?.get("id")).toBe("eq.order-owned");
    expect(query?.get("owner_scope")).toBe("eq.auth");
    expect(query?.get("select")).not.toMatch(/email|phone|address|note/);
  });

  it("returns only saved variants and their catalog-safe presentation", async () => {
    let call = 0;
    const fetcher = vi.fn(async () => {
      call += 1;
      return call === 1
        ? jsonResponse([{ variant_id: "00000000-0000-4000-8000-000000000001" }])
        : jsonResponse([{
            localized_product_name: "Ghế thử nghiệm",
            product_name: "Test chair",
            product_slug: "test-chair",
            storefront: true,
            variant_id: "00000000-0000-4000-8000-000000000001",
          }]);
    });
    const repository = createAccountDataRepository({
      baseUrl,
      fetcher: fetcher as unknown as typeof fetch,
      projectRef,
      mutationsEnabled: false,
      serviceRoleKey: "not-printed",
    });

    await expect(repository.listWishlistItems("account-owned")).resolves.toEqual([{
      available: true,
      productSlug: "test-chair",
      title: "Ghế thử nghiệm",
      variantId: "00000000-0000-4000-8000-000000000001",
    }]);
  });

  it("reads a cart from the exact account and derives availability and price server-side", async () => {
    const calls: URL[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(url);
      if (calls.length === 1) return jsonResponse([{ id: "cart-owned", version: "2" }]);
      if (calls.length === 2) {
        return jsonResponse([{
          quantity: 2,
          variant_id: "00000000-0000-4000-8000-000000000001",
        }]);
      }
      return jsonResponse([{
        cart: true,
        localized_name: "Ghế thử nghiệm",
        localized_product_name: null,
        price: "125000",
        product_name: null,
        product_slug: "test-chair",
        variant_id: "00000000-0000-4000-8000-000000000001",
        variant_name: "Test chair",
      }]);
    });
    const repository = createAccountDataRepository({
      baseUrl,
      fetcher: fetcher as unknown as typeof fetch,
      projectRef,
      mutationsEnabled: false,
      serviceRoleKey: "not-printed",
    });

    await expect(repository.getCart("account-owned")).resolves.toEqual({
      items: [{
        available: true,
        productSlug: "test-chair",
        quantity: 2,
        title: "Ghế thử nghiệm",
        unitAmount: 125000,
        variantId: "00000000-0000-4000-8000-000000000001",
      }],
      version: 2,
    });
    expect(calls[0]?.pathname).toBe("/rest/v1/carts");
    expect(calls[0]?.searchParams.get("account_id")).toBe("eq.account-owned");
    expect(calls[1]?.searchParams.get("cart_id")).toBe("eq.cart-owned");
    expect(calls[2]?.pathname).toBe("/rest/v1/catalog_eligibility");
  });

  it("uses account-scoped cart RPCs and parses merge receipts without exposing browser totals", async () => {
    const calls: Array<Readonly<{ body: unknown; url: URL }>> = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        body: JSON.parse(String(init?.body)),
        url: new URL(String(input)),
      });
      return calls.length === 1
        ? jsonResponse([{ cart_version: 4, result_status: "updated" }])
        : jsonResponse({ changedLines: 1, removedLines: 1, version: 5 });
    });
    const repository = createAccountDataRepository({
      baseUrl,
      fetcher: fetcher as unknown as typeof fetch,
      projectRef,
      mutationsEnabled: true,
      serviceRoleKey: "not-printed",
    });
    const variantId = "00000000-0000-4000-8000-000000000001";

    await expect(repository.mutateCart("account-owned", {
      expectedVersion: 3,
      operation: "update",
      quantity: 2,
      variantId,
    })).resolves.toEqual({ status: "updated", version: 4 });
    await expect(repository.mergeGuestCart(
      "account-owned",
      "merge-001",
      [{ quantity: 1, variantId }],
    )).resolves.toEqual({ changedLines: 1, removedLines: 1, version: 5 });

    expect(calls[0]?.url.pathname).toBe("/rest/v1/rpc/mutate_customer_account_cart");
    expect(calls[0]?.body).toEqual({
      p_account_id: "account-owned",
      p_expected_version: 3,
      p_operation: "update",
      p_quantity: 2,
      p_variant_id: variantId,
    });
    expect(calls[1]?.url.pathname).toBe("/rest/v1/rpc/merge_customer_guest_cart");
    expect(calls[1]?.body).toEqual({
      p_account_id: "account-owned",
      p_idempotency_key: "merge-001",
      p_items: [{ quantity: 1, variantId }],
    });
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
