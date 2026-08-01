import { afterEach, describe, expect, it, vi } from "vitest";

import {
  amisReadOnlyFetch,
  assertAmisRequestAllowed,
  RemoteWriteBlockedError,
  supabaseAmisSyncFetch,
  supabaseCheckoutFetch,
  supabaseEmailLinkRecoveryFetch,
  supabaseInstagramSyncFetch,
  supabaseReadOnlyFetch,
} from "@/lib/remote-read-only";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("remote read-only safeguard", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("blocks Supabase %s before network I/O", async (method) => {
    const networkFetch = vi.fn();
    vi.stubGlobal("fetch", networkFetch);

    await expect(supabaseReadOnlyFetch("https://example.supabase.co/rest/v1/products", { method }))
      .rejects.toBeInstanceOf(RemoteWriteBlockedError);
    expect(networkFetch).not.toHaveBeenCalled();
  });

  it("allows Supabase GET", async () => {
    const networkFetch = vi.fn(async () => new Response("[]"));
    vi.stubGlobal("fetch", networkFetch);

    await expect(supabaseReadOnlyFetch("https://example.supabase.co/rest/v1/products", { method: "GET" }))
      .resolves.toBeInstanceOf(Response);
    expect(networkFetch).toHaveBeenCalledOnce();
  });

  it.each([
    ["POST", "token"],
    ["POST", "signup"],
    ["POST", "logout"],
    ["POST", "recover"],
    ["POST", "verify"],
    ["POST", "otp"],
    ["POST", "reauthenticate"],
    ["POST", "resend"],
    ["PUT", "user"],
    ["PATCH", "user"],
  ])("allows Supabase Auth %s on %s", async (method, endpoint) => {
    const networkFetch = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", networkFetch);

    await expect(supabaseReadOnlyFetch(`https://example.supabase.co/auth/v1/${endpoint}`, { method }))
      .resolves.toBeInstanceOf(Response);
    expect(networkFetch).toHaveBeenCalledOnce();
  });

  it.each([
    ["DELETE", "user"],
    ["PATCH", "signup"],
    ["POST", "admin/users"],
  ])("blocks non-allowlisted Supabase Auth %s on %s", async (method, endpoint) => {
    const networkFetch = vi.fn();
    vi.stubGlobal("fetch", networkFetch);

    await expect(supabaseReadOnlyFetch(`https://example.supabase.co/auth/v1/${endpoint}`, { method }))
      .rejects.toBeInstanceOf(RemoteWriteBlockedError);
    expect(networkFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["POST", "rpc/apply_amis_inventory_sync"],
    ["POST", "amis_sync_log"],
    ["PATCH", "amis_sync_log"],
    ["PATCH", "variants"],
  ])("allows cron-scoped Supabase %s on %s", async (method, table) => {
    const networkFetch = vi.fn(async () => new Response("[]"));
    vi.stubGlobal("fetch", networkFetch);

    await expect(supabaseAmisSyncFetch(`https://example.supabase.co/rest/v1/${table}`, { method }))
      .resolves.toBeInstanceOf(Response);
    expect(networkFetch).toHaveBeenCalledOnce();
  });

  it.each([
    ["POST", "variants"],
    ["DELETE", "variants"],
    ["PATCH", "orders"],
    ["POST", "amis_sync_log/extra"],
    ["PATCH", "rpc/apply_amis_inventory_sync"],
  ])("blocks cron-scoped Supabase %s on %s", async (method, table) => {
    const networkFetch = vi.fn();
    vi.stubGlobal("fetch", networkFetch);

    await expect(supabaseAmisSyncFetch(`https://example.supabase.co/rest/v1/${table}`, { method }))
      .rejects.toBeInstanceOf(RemoteWriteBlockedError);
    expect(networkFetch).not.toHaveBeenCalled();
  });

  it("allows only the checkout RPC POST before network I/O", async () => {
    // Given: a checkout-scoped Supabase fetch adapter.
    const networkFetch = vi.fn(async () => new Response("[]"));
    vi.stubGlobal("fetch", networkFetch);

    // When: it posts to the exact checkout RPC path.
    await expect(
      supabaseCheckoutFetch("https://example.supabase.co/rest/v1/rpc/capture_order_from_cart", { method: "POST" }),
    ).resolves.toBeInstanceOf(Response);

    // Then: the request is allowed to reach the network.
    expect(networkFetch).toHaveBeenCalledOnce();
  });

  it("allows checkout-session GET requests", async () => {
    // Given: a checkout-scoped Supabase fetch adapter.
    const networkFetch = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", networkFetch);

    // When: session authentication requests the current user.
    await expect(supabaseCheckoutFetch("https://example.supabase.co/auth/v1/user", { method: "GET" }))
      .resolves.toBeInstanceOf(Response);

    // Then: read-only authentication reaches the network.
    expect(networkFetch).toHaveBeenCalledOnce();
  });

  it.each([
    ["POST", "/rest/v1/orders"],
    ["PATCH", "/rest/v1/rpc/capture_order_from_cart"],
    ["POST", "/rest/v1/rpc/other_function"],
  ])("blocks checkout-scoped Supabase %s on %s", async (method, path) => {
    // Given: a checkout-scoped Supabase fetch adapter.
    const networkFetch = vi.fn();
    vi.stubGlobal("fetch", networkFetch);

    // When: it attempts an unapproved write.
    const request = supabaseCheckoutFetch(`https://example.supabase.co${path}`, { method });

    // Then: the write is rejected before network I/O.
    await expect(request).rejects.toBeInstanceOf(RemoteWriteBlockedError);
    expect(networkFetch).not.toHaveBeenCalled();
  });

  it.each([
    "begin_email_link_recovery_transaction",
    "consume_email_link_recovery_transaction",
    "inspect_email_link_recovery_transaction",
  ])("allows only the email-recovery RPC POST for %s", async (functionName) => {
    const networkFetch = vi.fn(async () => new Response("true"));
    vi.stubGlobal("fetch", networkFetch);

    await expect(supabaseEmailLinkRecoveryFetch(
      `https://example.supabase.co/rest/v1/rpc/${functionName}`,
      { method: "POST" },
    )).resolves.toBeInstanceOf(Response);
    expect(networkFetch).toHaveBeenCalledOnce();
  });

  it.each([
    ["GET", "/rest/v1/rpc/inspect_email_link_recovery_transaction"],
    ["PATCH", "/rest/v1/rpc/consume_email_link_recovery_transaction"],
    ["POST", "/rest/v1/rpc/other_function"],
    ["POST", "/rest/v1/email_link_recovery_transactions"],
  ])("blocks email-recovery scoped Supabase %s on %s", async (method, path) => {
    const networkFetch = vi.fn();
    vi.stubGlobal("fetch", networkFetch);

    await expect(supabaseEmailLinkRecoveryFetch(`https://example.supabase.co${path}`, { method }))
      .rejects.toBeInstanceOf(RemoteWriteBlockedError);
    expect(networkFetch).not.toHaveBeenCalled();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("blocks AMIS business-data %s on Products", (method) => {
    expect(() => assertAmisRequestAllowed(new URL("https://crmconnect.misa.vn/api/v2/Products"), method))
      .toThrow(RemoteWriteBlockedError);
  });

  it("allows only the AMIS token-exchange POST on Account", () => {
    expect(() => assertAmisRequestAllowed(
      new URL("https://crmconnect.misa.vn/api/v2/Account"),
      "POST",
    )).not.toThrow();
  });

  it.each(["GET", "PUT", "PATCH", "DELETE"])("blocks non-POST methods on AMIS Account", (method) => {
    expect(() => assertAmisRequestAllowed(new URL("https://crmconnect.misa.vn/api/v2/Account"), method))
      .toThrow(RemoteWriteBlockedError);
  });

  it("allows GET on AMIS Products", () => {
    expect(() => assertAmisRequestAllowed(
      new URL("https://crmconnect.misa.vn/api/v2/Products?page=0"),
      "GET",
    )).not.toThrow();
  });

  it.each(["GET", "HEAD"])("allows %s on the AMIS stock ledger", (method) => {
    expect(() => assertAmisRequestAllowed(
      new URL("https://crmconnect.misa.vn/api/v2/Stocks/product_ledger?page=1&pageSize=50"),
      method,
    )).not.toThrow();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("blocks %s on the AMIS stock ledger", (method) => {
    expect(() => assertAmisRequestAllowed(
      new URL("https://crmconnect.misa.vn/api/v2/Stocks/product_ledger"),
      method,
    )).toThrow(RemoteWriteBlockedError);
  });

  it.each(["GET", "HEAD"])("allows %s on AMIS Sale Orders", (method) => {
    // Given: the AMIS Sale Order endpoint is required for availability deltas.
    const url = new URL("https://crmconnect.misa.vn/api/v2/SaleOrders?page=0&pageSize=100");

    // When: the client requests an allowed read method.
    const request = () => assertAmisRequestAllowed(url, method);

    // Then: the read passes the remote safeguard.
    expect(request).not.toThrow();
  });

  it.each([
    "http://crmconnect.misa.vn/api/v2/Products",
    "https://crmconnect.misa.vn:8443/api/v2/Products",
    "https://crmconnect.misa.vn.evil.test/api/v2/Products",
    "https://user:password@crmconnect.misa.vn/api/v2/Products",
  ])("blocks AMIS requests outside the exact HTTPS origin %s", (url) => {
    expect(() => assertAmisRequestAllowed(new URL(url), "GET"))
      .toThrow(RemoteWriteBlockedError);
  });

  it.each(["/api/v2/Customers", "/api/v2/Contacts"])("allows AMIS safe read on %s", (pathname) => {
    expect(() => assertAmisRequestAllowed(
      new URL(`https://crmconnect.misa.vn${pathname}?page=0&pageSize=100&orderBy=modified_date&isDescending=true`),
      "GET",
    ))
      .not.toThrow();
  });

  it.each([
    "page=-1",
    "page=0&page=1",
    "pageSize=0",
    "pageSize=101",
    "orderBy=office_tel",
    "isDescending=false",
    "filter=all",
  ])("blocks unsafe AMIS Customer paging query before network I/O: %s", (query) => {
    expect(() => assertAmisRequestAllowed(
      new URL(`https://crmconnect.misa.vn/api/v2/Customers?${query}`),
      "GET",
    )).toThrow(RemoteWriteBlockedError);
  });

  it.each([
    "/api/v2/Products/123",
    "/api/v2/Orders",
    "/api/v1/Products",
  ])("blocks AMIS GET on non-allowlisted path %s", (pathname) => {
    expect(() => assertAmisRequestAllowed(new URL(`https://crmconnect.misa.vn${pathname}`), "GET"))
      .toThrow(RemoteWriteBlockedError);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "amisReadOnlyFetch blocks %s to Products before network I/O",
    async (method) => {
      const networkFetch = vi.fn();
      vi.stubGlobal("fetch", networkFetch);

      await expect(
        amisReadOnlyFetch("https://crmconnect.misa.vn/api/v2/Products", { method }),
      ).rejects.toBeInstanceOf(RemoteWriteBlockedError);
      expect(networkFetch).not.toHaveBeenCalled();
    },
  );

  it("amisReadOnlyFetch allows GET Products and POST Account only", async () => {
    const networkFetch = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", networkFetch);

    await expect(
      amisReadOnlyFetch("https://crmconnect.misa.vn/api/v2/Products?page=0", { method: "GET" }),
    ).resolves.toBeInstanceOf(Response);
    await expect(
      amisReadOnlyFetch("https://crmconnect.misa.vn/api/v2/Account", {
        method: "POST",
        body: "{}",
      }),
    ).resolves.toBeInstanceOf(Response);
    expect(networkFetch).toHaveBeenCalledTimes(2);
  });

  describe("local PostgREST raw port fallback (PGRST125)", () => {
    it("performs fallback retry for local GET requests on localhost/127.0.0.1/[::1]", async () => {
      const urlsCalled: string[] = [];
      const networkFetch = vi.fn(async (input) => {
        const req = (input instanceof Request) ? input.clone() : new Request(input);
        urlsCalled.push(req.url);
        if (urlsCalled.length === 1) {
          return new Response(
            JSON.stringify({ code: "PGRST125", message: "Invalid path specified in request URL" }),
            { status: 404, headers: { "content-type": "application/json" } }
          );
        }
        return new Response(JSON.stringify([{ id: 1 }]), { status: 200 });
      });
      vi.stubGlobal("fetch", networkFetch);

      const response = await supabaseReadOnlyFetch("http://localhost:54321/rest/v1/products?select=*");
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual([{ id: 1 }]);
      expect(urlsCalled).toEqual([
        "http://localhost:54321/rest/v1/products?select=*",
        "http://localhost:54321/products?select=*"
      ]);
      expect(networkFetch).toHaveBeenCalledTimes(2);
    });

    it("does not retry remote/production requests even on PGRST125", async () => {
      const urlsCalled: string[] = [];
      const networkFetch = vi.fn(async (input) => {
        const req = (input instanceof Request) ? input.clone() : new Request(input);
        urlsCalled.push(req.url);
        return new Response(
          JSON.stringify({ code: "PGRST125", message: "Invalid path specified in request URL" }),
          { status: 404, headers: { "content-type": "application/json" } }
        );
      });
      vi.stubGlobal("fetch", networkFetch);

      const response = await supabaseReadOnlyFetch("https://example.supabase.co/rest/v1/products");
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.code).toBe("PGRST125");
      expect(urlsCalled).toEqual(["https://example.supabase.co/rest/v1/products"]);
      expect(networkFetch).toHaveBeenCalledOnce();
    });

    it("does not retry non-PGRST125 responses on localhost", async () => {
      const urlsCalled: string[] = [];
      const networkFetch = vi.fn(async (input) => {
        const req = (input instanceof Request) ? input.clone() : new Request(input);
        urlsCalled.push(req.url);
        return new Response(
          JSON.stringify({ code: "SOME_OTHER_ERROR", message: "Not found" }),
          { status: 404, headers: { "content-type": "application/json" } }
        );
      });
      vi.stubGlobal("fetch", networkFetch);

      const response = await supabaseReadOnlyFetch("http://127.0.0.1:54321/rest/v1/products");
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.code).toBe("SOME_OTHER_ERROR");
      expect(urlsCalled).toEqual(["http://127.0.0.1:54321/rest/v1/products"]);
      expect(networkFetch).toHaveBeenCalledOnce();
    });

    it("preserves body, headers, method, and signal for allowed local Instagram RPC POST", async () => {
      const urlsCalled: string[] = [];
      const methodsCalled: string[] = [];
      const headersCalled: Headers[] = [];
      const bodiesCalled: string[] = [];
      const signalsCalled: boolean[] = [];

      const controller = new AbortController();

      const networkFetch = vi.fn(async (input) => {
        const req = (input instanceof Request) ? input.clone() : new Request(input);
        urlsCalled.push(req.url);
        methodsCalled.push(req.method);
        headersCalled.push(req.headers);
        bodiesCalled.push(await req.text());
        signalsCalled.push(req.signal.aborted);

        if (urlsCalled.length === 1) {
          return new Response(
            JSON.stringify({ code: "PGRST125", message: "Invalid path specified in request URL" }),
            { status: 404, headers: { "content-type": "application/json" } }
          );
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });
      vi.stubGlobal("fetch", networkFetch);

      const payload = { test: "data" };
      const response = await supabaseInstagramSyncFetch("http://[::1]:54321/rest/v1/rpc/publish_instagram_stage", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-custom-header": "test-val"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      expect(response.status).toBe(200);
      expect(urlsCalled).toEqual([
        "http://[::1]:54321/rest/v1/rpc/publish_instagram_stage",
        "http://[::1]:54321/rpc/publish_instagram_stage"
      ]);
      expect(methodsCalled).toEqual(["POST", "POST"]);
      expect(headersCalled[1].get("content-type")).toBe("application/json");
      expect(headersCalled[1].get("x-custom-header")).toBe("test-val");
      expect(JSON.parse(bodiesCalled[0])).toEqual(payload);
      expect(JSON.parse(bodiesCalled[1])).toEqual(payload);
      expect(signalsCalled).toEqual([false, false]);
      expect(networkFetch).toHaveBeenCalledTimes(2);
    });
  });
});
