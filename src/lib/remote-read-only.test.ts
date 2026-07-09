import { afterEach, describe, expect, it, vi } from "vitest";

import {
  amisReadOnlyFetch,
  assertAmisRequestAllowed,
  RemoteWriteBlockedError,
  supabaseAmisSyncFetch,
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
  ])("blocks cron-scoped Supabase %s on %s", async (method, table) => {
    const networkFetch = vi.fn();
    vi.stubGlobal("fetch", networkFetch);

    await expect(supabaseAmisSyncFetch(`https://example.supabase.co/rest/v1/${table}`, { method }))
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

  it.each([
    "/api/v2/Products/123",
    "/api/v2/Orders",
    "/api/v2/Customers",
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
});
