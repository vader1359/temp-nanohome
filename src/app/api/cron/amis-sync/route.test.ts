import { afterEach, describe, expect, it, vi } from "vitest";

type LogInsert = {
  readonly status?: string | null;
  readonly items_processed?: number | null;
  readonly items_failed?: number | null;
  readonly error?: string | null;
};

type VariantUpdate = {
  readonly price?: number | null;
  readonly compare_at_price?: number | null;
  readonly discount_percent?: number | null;
  readonly in_stock?: boolean;
  readonly source_updated_at?: string | null;
};

type SupabaseState = {
  readonly logs: LogInsert[];
  readonly variantUpdates: VariantUpdate[];
};

const state = vi.hoisted<SupabaseState>(() => ({
  logs: [],
  variantUpdates: [],
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => createSupabaseFake()),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  state.logs.length = 0;
  state.variantUpdates.length = 0;
});

describe("POST /api/cron/amis-sync", () => {
  it("returns 401 when the cron secret is wrong", async () => {
    // Given: a configured cron secret and an invalid bearer token.
    setRouteEnv({ AMIS_API_BASE_URL: "https://amis.example.test", AMIS_API_KEY: "amis-key" });
    const { POST } = await import("./route");

    // When: the route is invoked with the wrong Authorization header.
    const response = await POST(new Request("https://app.test/api/cron/amis-sync", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
    }));

    // Then: the request is rejected before any backend mutation.
    expect(response.status).toBe(401);
    expect(state.logs).toHaveLength(0);
  });

  it("returns 200 and logs failed when AMIS credentials are missing", async () => {
    // Given: cron auth is valid but AMIS credentials are incomplete.
    setRouteEnv({ AMIS_API_BASE_URL: undefined, AMIS_API_KEY: undefined });
    const { POST } = await import("./route");

    // When: the route runs.
    const response = await POST(authorizedRequest());
    const body = await response.json();

    // Then: cron receives a non-throwing failed sync result and a log update is recorded.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "failed", itemsProcessed: 0, itemsFailed: 0 });
    expect(state.logs.at(-1)).toMatchObject({ status: "failed", items_processed: 0, items_failed: 0 });
  });

  it("returns 200 partial when AMIS returns 404", async () => {
    // Given: static API key credentials and an AMIS endpoint that returns 404.
    setRouteEnv({ AMIS_API_BASE_URL: "https://amis.example.test", AMIS_API_KEY: "amis-key" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
    const { POST } = await import("./route");

    // When: the route runs.
    const response = await POST(authorizedRequest());
    const body = await response.json();

    // Then: AMIS failure is logged as partial without a 500.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "partial", itemsProcessed: 0, itemsFailed: 1 });
    expect(state.logs.at(-1)).toMatchObject({ status: "partial", items_processed: 0, items_failed: 1 });
  });

  it("updates variants by SKU from a valid AMIS payload", async () => {
    // Given: AMIS returns one variant record keyed by SKU.
    setRouteEnv({ AMIS_API_BASE_URL: "https://amis.example.test", AMIS_API_KEY: "amis-key" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: [{ sku: "SKU-1", price: 1200000, in_stock: true }] })),
    );
    const { POST } = await import("./route");

    // When: the route runs.
    const response = await POST(authorizedRequest());
    const body = await response.json();

    // Then: the matching SKU update is attempted and counted as processed.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "success", itemsProcessed: 1, itemsFailed: 0 });
    expect(state.variantUpdates).toEqual([{ price: 1200000, in_stock: true }]);
  });

  it("returns 200 failed when AMIS returns a malformed payload", async () => {
    // Given: AMIS returns JSON without the required data array.
    setRouteEnv({ AMIS_API_BASE_URL: "https://amis.example.test", AMIS_API_KEY: "amis-key" });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ result: [] })));
    const { POST } = await import("./route");

    // When: the route runs.
    const response = await POST(authorizedRequest());
    const body = await response.json();

    // Then: malformed external data is logged without surfacing a 500.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "failed", itemsProcessed: 0, itemsFailed: 1 });
    expect(state.logs.at(-1)).toMatchObject({ status: "failed", items_processed: 0, items_failed: 1 });
  });

  it("returns 200 partial when a variant update fails", async () => {
    // Given: AMIS returns one record whose SKU maps to a failed backend update.
    setRouteEnv({ AMIS_API_BASE_URL: "https://amis.example.test", AMIS_API_KEY: "amis-key" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: [{ sku: "FAIL", price: 1200000, in_stock: false }] })),
    );
    const { POST } = await import("./route");

    // When: the route runs.
    const response = await POST(authorizedRequest());
    const body = await response.json();

    // Then: failed items are counted as partial without a 500.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "partial", itemsProcessed: 0, itemsFailed: 1 });
    expect(state.logs.at(-1)).toMatchObject({ status: "partial", items_processed: 0, items_failed: 1 });
  });
});

function authorizedRequest(): Request {
  return new Request("https://app.test/api/cron/amis-sync", {
    method: "POST",
    headers: { Authorization: "Bearer cron-test" },
  });
}

function setRouteEnv(amis: { readonly AMIS_API_BASE_URL: string | undefined; readonly AMIS_API_KEY: string | undefined }): void {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
  vi.stubEnv("CRON_SECRET", "cron-test");

  if (amis.AMIS_API_BASE_URL === undefined) {
    vi.stubEnv("AMIS_API_BASE_URL", "");
  } else {
    vi.stubEnv("AMIS_API_BASE_URL", amis.AMIS_API_BASE_URL);
  }

  if (amis.AMIS_API_KEY === undefined) {
    vi.stubEnv("AMIS_API_KEY", "");
  } else {
    vi.stubEnv("AMIS_API_KEY", amis.AMIS_API_KEY);
  }
}

function createSupabaseFake() {
  return {
    from(table: string) {
      if (table === "amis_sync_log") {
        return createLogTableFake();
      }

      if (table === "variants") {
        return createVariantTableFake();
      }

      throw new RangeError(`unexpected table ${table}`);
    },
  };
}

function createLogTableFake() {
  return {
    insert(rows: readonly LogInsert[]) {
      state.logs.push(...rows);
      return {
        select() {
          return {
            single: async () => ({ data: { id: "log-1" }, error: null }),
          };
        },
      };
    },
    update(row: LogInsert) {
      state.logs.push(row);
      return {
        eq: async () => ({ error: null }),
      };
    },
    select() {
      return {
        in() {
          return {
            order() {
              return {
                limit: async () => ({ data: [], error: null }),
              };
            },
          };
        },
      };
    },
  };
}

function createVariantTableFake() {
  return {
    update(row: VariantUpdate) {
      state.variantUpdates.push(row);
      return {
        eq: async (_column: string, value: string) => ({
          error: value === "FAIL" ? new Error("variant update failed") : null,
        }),
      };
    },
  };
}
