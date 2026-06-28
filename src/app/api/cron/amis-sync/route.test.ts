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
  createAmisSyncAdminClient: vi.fn(() => createSupabaseFake()),
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
    setRouteEnv(configuredAmisEnv());
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
    setRouteEnv({ AMIS_API_BASE_URL: undefined, AMIS_CLIENT_ID: undefined, AMIS_CLIENT_SECRET: undefined });
    const { POST } = await import("./route");

    // When: the route runs.
    const response = await POST(authorizedRequest());
    const body = await response.json();

    // Then: cron records the failed sync in its dedicated Supabase log table.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "failed", itemsProcessed: 0, itemsFailed: 0 });
    expect(state.logs.at(-1)).toMatchObject({ status: "failed", items_processed: 0, items_failed: 0 });
  });

  it("returns 200 partial when AMIS returns 404", async () => {
    // Given: token exchange succeeds and the read-only Products endpoint returns 404.
    setRouteEnv(configuredAmisEnv());
    vi.stubGlobal("fetch", createAmisFetchMock(new Response("not found", { status: 404 })));
    const { POST } = await import("./route");

    // When: the route runs.
    const response = await POST(authorizedRequest());
    const body = await response.json();

    // Then: AMIS failure is recorded as partial without surfacing a 500.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "partial", itemsProcessed: 0, itemsFailed: 1 });
    expect(state.logs.at(-1)).toMatchObject({ status: "partial", items_processed: 0, items_failed: 1 });
  });

  it("updates Supabase variants by SKU from a valid AMIS payload", async () => {
    // Given: AMIS returns one variant record keyed by SKU.
    setRouteEnv(configuredAmisEnv());
    const amisFetch = createAmisFetchMock(Response.json({
      success: true,
      code: 200,
      data: [{
        product_code: "SKU-1",
        unit_price: 1200000,
        modified_date: "2026-06-28T17:02:53.000+07:00",
      }],
    }));
    vi.stubGlobal("fetch", amisFetch);
    const { POST } = await import("./route");

    // When: the route reads AMIS and applies the allowed Supabase sync writes.
    const response = await POST(authorizedRequest());
    const body = await response.json();

    // Then: only the matching Supabase variant is updated.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "success",
      itemsProcessed: 1,
      itemsFailed: 0,
    });
    expect(state.variantUpdates).toEqual([{
      price: 1200000,
      source_updated_at: "2026-06-28T17:02:53.000+07:00",
    }]);
    expect(amisFetch).toHaveBeenCalledTimes(2);
    expect(amisFetch.mock.calls.map(([, init]) => init?.method)).toEqual(["POST", "GET"]);
    expect(String(amisFetch.mock.calls[1]?.[0])).toContain("/api/v2/Products?");
  });

  it("returns 200 failed when AMIS returns a malformed payload", async () => {
    // Given: AMIS returns JSON without the required data array.
    setRouteEnv(configuredAmisEnv());
    vi.stubGlobal("fetch", createAmisFetchMock(Response.json({ success: true, code: 200, result: [] })));
    const { POST } = await import("./route");

    // When: the route runs.
    const response = await POST(authorizedRequest());
    const body = await response.json();

    // Then: malformed external data is recorded without surfacing a 500.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "failed", itemsProcessed: 0, itemsFailed: 1 });
    expect(state.logs.at(-1)).toMatchObject({ status: "failed", items_processed: 0, items_failed: 1 });
  });

  it("returns partial when an allowed Supabase variant update fails", async () => {
    // Given: AMIS returns a product whose Supabase variant update fails.
    setRouteEnv(configuredAmisEnv());
    vi.stubGlobal("fetch", createAmisFetchMock(Response.json({
      success: true,
      code: 200,
      data: [{
        product_code: "FAIL",
        unit_price: "1200000",
        modified_date: "2026-06-28T17:02:53.000+07:00",
      }],
    })));
    const { POST } = await import("./route");

    // When: the route runs.
    const response = await POST(authorizedRequest());
    const body = await response.json();

    // Then: the failure is recorded as partial.
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

type AmisTestEnv = {
  readonly AMIS_API_BASE_URL: string | undefined;
  readonly AMIS_CLIENT_ID: string | undefined;
  readonly AMIS_CLIENT_SECRET: string | undefined;
};

function configuredAmisEnv(): AmisTestEnv {
  return {
    AMIS_API_BASE_URL: "https://amis.example.test",
    AMIS_CLIENT_ID: "nanohome",
    AMIS_CLIENT_SECRET: "amis-secret",
  };
}

function setRouteEnv(amis: AmisTestEnv): void {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
  vi.stubEnv("CRON_SECRET", "cron-test");

  if (amis.AMIS_API_BASE_URL === undefined) {
    vi.stubEnv("AMIS_API_BASE_URL", "");
  } else {
    vi.stubEnv("AMIS_API_BASE_URL", amis.AMIS_API_BASE_URL);
  }

  if (amis.AMIS_CLIENT_ID === undefined) {
    vi.stubEnv("AMIS_CLIENT_ID", "");
  } else {
    vi.stubEnv("AMIS_CLIENT_ID", amis.AMIS_CLIENT_ID);
  }

  if (amis.AMIS_CLIENT_SECRET === undefined) {
    vi.stubEnv("AMIS_CLIENT_SECRET", "");
  } else {
    vi.stubEnv("AMIS_CLIENT_SECRET", amis.AMIS_CLIENT_SECRET);
  }
}

function createAmisFetchMock(productsResponse: Response) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);

    if (url.endsWith("/api/v2/Account")) {
      expect(init?.method).toBe("POST");
      return Response.json({ success: true, code: 0, data: "amis-access-token" });
    }

    expect(url).toContain("/api/v2/Products?");
    expect(init?.method).toBe("GET");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer amis-access-token");
    expect(new Headers(init?.headers).get("Clientid")).toBe("nanohome");
    return productsResponse;
  });
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
