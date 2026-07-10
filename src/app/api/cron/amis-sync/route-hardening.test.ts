import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAmisFetchMock,
  createAmisProduct,
  createSupabaseFake,
  productsFetchPages,
  resetState,
  setRouteEnv,
  type SupabaseState,
} from "./amis-sync.test-support";

const { state } = vi.hoisted(() => ({
  state: createSupabaseState(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAmisSyncAdminClient: vi.fn(() => createSupabaseFake(state)),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  resetState(state);
});

describe("GET /api/cron/amis-sync", () => {
  it("returns 401 when the cron secret is wrong", async () => {
    // Given: a configured cron secret and an invalid bearer token.
    setRouteEnv();
    const { GET } = await import("./route");

    // When: the route is invoked with the wrong Authorization header.
    const response = await GET(new Request("https://app.test/api/cron/amis-sync", {
      method: "GET",
      headers: { Authorization: "Bearer wrong-secret" },
    }));

    // Then: the request is rejected before any backend mutation.
    expect(response.status).toBe(401);
    expect(state.logs).toHaveLength(0);
  });

  it("returns 200 and runs the AMIS sync when the cron secret is valid", async () => {
    // Given: Vercel Cron invokes the route with GET and a valid bearer token.
    setRouteEnv();
    vi.stubGlobal("fetch", createAmisFetchMock([[createAmisProduct("SKU-1")]]));
    const { GET } = await import("./route");

    // When: the route runs.
    const response = await GET(new Request("https://app.test/api/cron/amis-sync", {
      method: "GET",
      headers: { Authorization: "Bearer cron-test" },
    }));
    const body = await response.json();

    // Then: the cron path works through the same sync surface as POST.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "success", itemsProcessed: 1, itemsFailed: 0 });
  });
});

describe("POST /api/cron/amis-sync hardening", () => {
  it("reads every AMIS Products page until the final short page", async () => {
    // Given: AMIS returns a full first page and a short second page.
    setRouteEnv();
    const firstPage = Array.from({ length: 100 }, (_value, index) => createAmisProduct(`SKU-${index}`));
    const secondPage = [createAmisProduct("SKU-100")];
    const amisFetch = createAmisFetchMock([firstPage, secondPage]);
    vi.stubGlobal("fetch", amisFetch);
    const { POST } = await import("./route");

    // When: the route runs.
    const response = await POST(authorizedPostRequest());
    const body = await response.json();

    // Then: records from both AMIS pages are applied.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "success", itemsProcessed: 101, itemsFailed: 0 });
    expect(state.variantUpdates).toHaveLength(101);
    expect(amisFetch).toHaveBeenCalledTimes(3);
    expect(productsFetchPages(amisFetch)).toEqual(["0", "1"]);
  });

  it("returns partial when no Supabase variant matches an AMIS SKU", async () => {
    // Given: AMIS returns a SKU that does not exist in Supabase.
    setRouteEnv();
    vi.stubGlobal("fetch", createAmisFetchMock([[createAmisProduct("MISSING")]]));
    const { POST } = await import("./route");

    // When: the route runs.
    const response = await POST(authorizedPostRequest());
    const body = await response.json();

    // Then: zero-row Supabase updates are counted as failures, not successes.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "partial",
      itemsProcessed: 0,
      itemsFailed: 1,
      error: "No Supabase variant matched AMIS SKU MISSING",
    });
    expect(state.logs.at(-1)).toMatchObject({ status: "partial", items_processed: 0, items_failed: 1 });
  });

  it("does not advance the watermark when any AMIS SKU is unmatched", async () => {
    // Given: an existing cursor, a successful newer SKU, and a later unmatched SKU.
    setRouteEnv();
    state.watermark = "2026-06-27T17:02:53.000+07:00";
    vi.stubGlobal("fetch", createAmisFetchMock([[
      createAmisProduct("SKU-1", "2026-06-29T17:02:53.000+07:00"),
      createAmisProduct("MISSING", "2026-06-28T17:02:53.000+07:00"),
    ]]));
    const { POST } = await import("./route");

    // When: the newer SKU succeeds but the later one does not exist locally.
    const response = await POST(authorizedPostRequest());
    const body = await response.json();

    // Then: the cursor stays at its safe prior value so the failed SKU can be retried.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "partial", itemsProcessed: 1, itemsFailed: 1 });
    expect(state.logs.at(-1)).toMatchObject({ watermark: "2026-06-27T17:02:53.000+07:00" });
  });

  it("keeps a null watermark after a first-run partial result", async () => {
    // Given: the initial sync has no prior cursor and its only SKU is unmatched.
    setRouteEnv();
    vi.stubGlobal("fetch", createAmisFetchMock([[createAmisProduct("MISSING")]]));
    const { POST } = await import("./route");

    // When: the first run completes partially.
    const response = await POST(authorizedPostRequest());

    // Then: its log does not invent a timestamp cursor that would skip history.
    expect(response.status).toBe(200);
    expect(state.logs.at(-1)).toMatchObject({ status: "partial", watermark: null });
  });

  it("keeps the newest timestamp from the contiguous successful prefix", async () => {
    // Given: descending successful AMIS records newer than an existing cursor.
    setRouteEnv();
    state.watermark = "2026-06-27T17:02:53.000+07:00";
    vi.stubGlobal("fetch", createAmisFetchMock([[
      createAmisProduct("SKU-NEWEST", "2026-06-29T17:02:53.000+07:00"),
      createAmisProduct("SKU-OLDER", "2026-06-28T17:02:53.000+07:00"),
    ]]));
    const { POST } = await import("./route");

    // When: every record in the prefix updates successfully.
    const response = await POST(authorizedPostRequest());

    // Then: the next delta starts at the newest persisted source timestamp.
    expect(response.status).toBe(200);
    expect(state.logs.at(-1)).toMatchObject({ watermark: "2026-06-29T17:02:53.000+07:00" });
  });

  it("stops fetching once a full AMIS page is at or before the stored watermark", async () => {
    // Given: descending AMIS pages that move from newer records to an entirely old page.
    setRouteEnv();
    state.watermark = "2026-06-28T17:02:53.000+07:00";
    const newerPage = Array.from({ length: 100 }, (_value, index) =>
      createAmisProduct(`NEW-${index}`, "2026-06-29T17:02:53.000+07:00"),
    );
    const oldPage = Array.from({ length: 100 }, (_value, index) =>
      createAmisProduct(`OLD-${index}`, "2026-06-27T17:02:53.000+07:00"),
    );
    const amisFetch = createAmisFetchMock([newerPage, oldPage]);
    vi.stubGlobal("fetch", amisFetch);
    const { POST } = await import("./route");

    // When: the sync reaches the first page with no newer records.
    const response = await POST(authorizedPostRequest());
    const body = await response.json();

    // Then: it applies only newer records and does not scan older pages.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "success", itemsProcessed: 100, itemsFailed: 0 });
    expect(productsFetchPages(amisFetch)).toEqual(["0", "1"]);
  });

  it("limits AMIS variant updates to ten concurrent requests", async () => {
    // Given: a full AMIS page and deliberately slow Supabase updates.
    setRouteEnv();
    state.variantUpdateDelayMs = 10;
    vi.stubGlobal("fetch", createAmisFetchMock([Array.from({ length: 100 }, (_value, index) => createAmisProduct(`SKU-${index}`))]));
    const { POST } = await import("./route");

    // When: the sync applies the page.
    const response = await POST(authorizedPostRequest());

    // Then: it completes with bounded parallelism instead of serial requests.
    expect(response.status).toBe(200);
    expect(state.maxConcurrentVariantUpdates).toBe(10);
  });

  it("finalizes the sync log when an unexpected AMIS client error escapes", async () => {
    // Given: AMIS token exchange throws after the running log row is created.
    setRouteEnv();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network reset");
    }));
    const { POST } = await import("./route");

    // When: the route runs.
    const response = await POST(authorizedPostRequest());
    const body = await response.json();

    // Then: the running log is closed as failed instead of remaining open.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "failed",
      itemsProcessed: 0,
      itemsFailed: 1,
      error: "network reset",
    });
    expect(state.logs.at(-1)).toMatchObject({
      status: "failed",
      items_processed: 0,
      items_failed: 1,
      error: "network reset",
    });
  });
});

function authorizedPostRequest(): Request {
  return new Request("https://app.test/api/cron/amis-sync", {
    method: "POST",
    headers: { Authorization: "Bearer cron-test" },
  });
}

function createSupabaseState(): SupabaseState {
  return {
    logs: [],
    variantUpdates: [],
    watermark: null,
    variantUpdateDelayMs: 0,
    activeVariantUpdates: 0,
    maxConcurrentVariantUpdates: 0,
  };
}
