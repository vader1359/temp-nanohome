import { afterEach, describe, expect, it, vi } from "vitest";

type LogInsert = {
  readonly status?: string | null;
  readonly items_processed?: number | null;
  readonly items_failed?: number | null;
  readonly error?: string | null;
};

type VariantUpdate = {
  readonly price?: number | null;
  readonly source_updated_at?: string | null;
};

type AmisProductFixture = {
  readonly product_code: string;
  readonly unit_price: number | string | null;
  readonly modified_date: string;
};

type SupabaseState = {
  readonly logs: LogInsert[];
  readonly variantUpdates: VariantUpdate[];
};

const state = vi.hoisted<SupabaseState>(() => ({ logs: [], variantUpdates: [] }));

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
});

function authorizedPostRequest(): Request {
  return new Request("https://app.test/api/cron/amis-sync", {
    method: "POST",
    headers: { Authorization: "Bearer cron-test" },
  });
}

function setRouteEnv(): void {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
  vi.stubEnv("CRON_SECRET", "cron-test");
  vi.stubEnv("AMIS_API_BASE_URL", "https://amis.example.test");
  vi.stubEnv("AMIS_CLIENT_ID", "nanohome");
  vi.stubEnv("AMIS_CLIENT_SECRET", "amis-secret");
}

function createAmisFetchMock(pages: readonly (readonly AmisProductFixture[])[]) {
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

    const page = Number(new URL(url).searchParams.get("page"));
    return Response.json({ success: true, code: 200, data: pages[page] ?? [] });
  });
}

function createAmisProduct(sku: string): AmisProductFixture {
  return {
    product_code: sku,
    unit_price: 1200000,
    modified_date: "2026-06-28T17:02:53.000+07:00",
  };
}

function productsFetchPages(fetchMock: ReturnType<typeof createAmisFetchMock>): readonly string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/api/v2/Products?"))
    .map((url) => new URL(url).searchParams.get("page") ?? "");
}

function createSupabaseFake() {
  return {
    from(table: string) {
      if (table === "amis_sync_log") return createLogTableFake();
      if (table === "variants") return createVariantTableFake();
      throw new RangeError(`unexpected table ${table}`);
    },
  };
}

function createLogTableFake() {
  return {
    insert(rows: readonly LogInsert[]) {
      state.logs.push(...rows);
      return { select: () => ({ single: async () => ({ data: { id: "log-1" }, error: null }) }) };
    },
    update(row: LogInsert) {
      state.logs.push(row);
      return { eq: async () => ({ error: null }) };
    },
    select: () => ({ in: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  };
}

function createVariantTableFake() {
  return {
    update(row: VariantUpdate, options?: { readonly count?: "exact" }) {
      expect(options).toEqual({ count: "exact" });
      state.variantUpdates.push(row);
      return {
        eq: async (_column: string, value: string) => ({
          error: null,
          count: value === "MISSING" ? 0 : 1,
        }),
      };
    },
  };
}
