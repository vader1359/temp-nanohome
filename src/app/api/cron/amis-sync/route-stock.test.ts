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

describe("POST /api/cron/amis-sync price-only behavior", () => {
  it("does not read or write the AMIS stock ledger when the price feed fails", async () => {
    // Given: the price feed fails while a ledger endpoint would reveal stale stock.
    setRouteEnv();
    state.localVariants.push({ id: "variant-1", sku: "SKU-1", stock: 1 });
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/api/v2/Account")) return Response.json({ success: true, code: 0, data: "token" });
      if (url.includes("/api/v2/Products?")) return new Response("product feed unavailable", { status: 503 });
      throw new RangeError(`unexpected AMIS request ${url}`);
    }));
    const { POST } = await import("./route");

    // When: the legacy cron route runs its independent price delta.
    const response = await POST(new Request("https://app.test/api/cron/amis-sync", {
      method: "POST",
      headers: { Authorization: "Bearer cron-test" },
    }));
    const body = await response.json();

    // Then: no legacy stock projection changes variants.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "partial", itemsProcessed: 0, itemsFailed: 1 });
    expect(state.stockUpdates).toEqual([]);
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
