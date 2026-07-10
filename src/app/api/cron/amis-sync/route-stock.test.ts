import { afterEach, describe, expect, it, vi } from "vitest";

import { createSupabaseFake, resetState, setRouteEnv, type SupabaseState } from "./amis-sync.test-support";

const { state } = vi.hoisted(() => ({ state: createSupabaseState() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAmisSyncAdminClient: vi.fn(() => createSupabaseFake(state)) }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  resetState(state);
});

describe("POST /api/cron/amis-sync stock independence", () => {
  it("reconciles changed stock when the AMIS Products request fails", async () => {
    // Given: the price feed fails while a uniquely matched ledger row is available.
    setRouteEnv();
    state.localVariants.push({ id: "variant-1", sku: "SKU-1", stock: 1 });
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/api/v2/Account")) return Response.json({ success: true, code: 0, data: "token" });
      if (url.includes("/api/v2/Products?")) return new Response("product feed unavailable", { status: 503 });
      if (url.includes("/api/v2/Stocks/product_ledger?")) {
        return Response.json({ success: false, code: 0, total_pages: 1, data: [{ product_code: "SKU-1", amount_summary: 2 }] });
      }
      throw new RangeError(`unexpected AMIS request ${url}`);
    }));
    const { POST } = await import("./route");

    // When: the cron route executes both independent AMIS feeds.
    const response = await POST(new Request("https://app.test/api/cron/amis-sync", {
      method: "POST",
      headers: { Authorization: "Bearer cron-test" },
    }));
    const body = await response.json();

    // Then: stock is written and the combined result retains the price failure.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "partial", itemsProcessed: 1, itemsFailed: 1 });
    expect(state.stockUpdates).toEqual([{ id: "variant-1", stock: 2 }]);
  });

  it("reconciles a uniquely matched variant beyond the first Supabase page", async () => {
    // Given: the only ledger match is after one thousand local variants.
    setRouteEnv();
    state.localVariants.push(
      ...Array.from({ length: 1_000 }, (_value, index) => ({ id: `variant-${index}`, sku: `SKU-${index}`, stock: null })),
      { id: "variant-late", sku: "SKU-LATE", stock: null },
    );
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/api/v2/Account")) return Response.json({ success: true, code: 0, data: "token" });
      if (url.includes("/api/v2/Products?")) return Response.json({ success: true, code: 200, data: [] });
      if (url.includes("/api/v2/Stocks/product_ledger?")) {
        return Response.json({ success: false, code: 0, total_pages: 1, data: [{ product_code: "SKU-LATE", amount_summary: 7 }] });
      }
      throw new RangeError(`unexpected AMIS request ${url}`);
    }));
    const { POST } = await import("./route");

    // When: the cron reconciles the full local variant set.
    const response = await POST(new Request("https://app.test/api/cron/amis-sync", {
      method: "POST",
      headers: { Authorization: "Bearer cron-test" },
    }));

    // Then: the second page match is updated by its unique ID.
    expect(response.status).toBe(200);
    expect(state.stockUpdates).toEqual([{ id: "variant-late", stock: 7 }]);
  });
});

function createSupabaseState(): SupabaseState {
  return {
    logs: [],
    variantUpdates: [],
    stockUpdates: [],
    localVariants: [],
    watermark: null,
    variantUpdateDelayMs: 0,
    activeVariantUpdates: 0,
    maxConcurrentVariantUpdates: 0,
  };
}
