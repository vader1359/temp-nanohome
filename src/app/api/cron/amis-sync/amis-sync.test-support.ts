import { expect, vi } from "vitest";

type LogInsert = {
  readonly status?: string | null;
  readonly items_processed?: number | null;
  readonly items_failed?: number | null;
  readonly error?: string | null;
  readonly watermark?: string | null;
};

type VariantUpdate = {
  readonly price?: number | null;
  readonly source_updated_at?: string | null;
  readonly stock?: number | null;
};

type StockUpdate = {
  readonly stock: number | null;
  readonly id: string;
};

export type LocalVariantFixture = {
  readonly id: string;
  readonly sku: string | null;
  readonly stock: number | null;
};

export type AmisProductFixture = {
  readonly product_code: string;
  readonly unit_price: number | string | null;
  readonly modified_date: string;
};

export type AmisLedgerFixture = {
  readonly product_code: string;
  readonly order_quantity: number | string;
};

type AmisLedgerPage = readonly AmisLedgerFixture[] | null;

export type SupabaseState = {
  readonly logs: LogInsert[];
  readonly variantUpdates: VariantUpdate[];
  readonly stockUpdates: StockUpdate[];
  readonly localVariants: LocalVariantFixture[];
  watermark: string | null;
  variantUpdateDelayMs: number;
  activeVariantUpdates: number;
  maxConcurrentVariantUpdates: number;
};

export function createSupabaseFake(state: SupabaseState) {
  return {
    from(table: string) {
      if (table === "amis_sync_log") return createLogTableFake(state);
      if (table === "variants") return createVariantTableFake(state);
      throw new RangeError(`unexpected table ${table}`);
    },
  };
}

export function resetState(state: SupabaseState): void {
  state.logs.length = 0;
  state.variantUpdates.length = 0;
  state.stockUpdates.length = 0;
  state.localVariants.length = 0;
  state.watermark = null;
  state.variantUpdateDelayMs = 0;
  state.activeVariantUpdates = 0;
  state.maxConcurrentVariantUpdates = 0;
}

export function setRouteEnv(): void {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
  vi.stubEnv("CRON_SECRET", "cron-test");
  vi.stubEnv("AMIS_API_BASE_URL", "https://crmconnect.misa.vn");
  vi.stubEnv("AMIS_CLIENT_ID", "nanohome");
  vi.stubEnv("AMIS_CLIENT_SECRET", "amis-secret");
}

export function createAmisFetchMock(
  pages: readonly (readonly AmisProductFixture[])[],
  ledgerPages: readonly AmisLedgerPage[] = [[]],
) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);

    if (url.endsWith("/api/v2/Account")) {
      expect(init?.method).toBe("POST");
      return Response.json({ success: true, code: 0, data: "amis-access-token" });
    }

    if (url.includes("/api/v2/Stocks/product_ledger?")) {
      expect(init?.method).toBe("GET");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer amis-access-token");
      expect(new Headers(init?.headers).get("Clientid")).toBe("nanohome");
      const page = Number(new URL(url).searchParams.get("page"));
      const ledgerPage = ledgerPages[page - 1];
      if (ledgerPage === null) return new Response("stock ledger failed", { status: 500 });
      return Response.json({
        success: false,
        code: 0,
        total_pages: ledgerPages.length,
        data: ledgerPage ?? [],
      });
    }

    expect(url).toContain("/api/v2/Products?");
    expect(init?.method).toBe("GET");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer amis-access-token");
    expect(new Headers(init?.headers).get("Clientid")).toBe("nanohome");

    const page = Number(new URL(url).searchParams.get("page"));
    return Response.json({ success: true, code: 200, data: pages[page] ?? [] });
  });
}

export function createAmisProduct(sku: string, modifiedDate = "2026-06-28T17:02:53.000+07:00"): AmisProductFixture {
  return { product_code: sku, unit_price: 1200000, modified_date: modifiedDate };
}

export function productsFetchPages(fetchMock: ReturnType<typeof createAmisFetchMock>): readonly string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/api/v2/Products?"))
    .map((url) => new URL(url).searchParams.get("page") ?? "");
}

function createLogTableFake(state: SupabaseState) {
  return {
    insert(rows: readonly LogInsert[]) {
      state.logs.push(...rows);
      return { select: () => ({ single: async () => ({ data: { id: "log-1" }, error: null }) }) };
    },
    update(row: LogInsert) {
      state.logs.push(row);
      return { eq: async () => ({ error: null }) };
    },
    select: () => ({
      in: () => ({
        order: () => ({
          limit: async () => ({
            data: state.watermark === null ? [] : [{ watermark: state.watermark, started_at: state.watermark }],
            error: null,
          }),
        }),
      }),
    }),
  };
}

function createVariantTableFake(state: SupabaseState) {
  return {
    select: () => ({
      range: async (from: number, to: number) => ({ data: state.localVariants.slice(from, to + 1), error: null }),
    }),
    update(row: VariantUpdate, options?: { readonly count?: "exact" }) {
      expect(options).toEqual({ count: "exact" });
      return {
        eq: async (column: string, value: string) => {
          if (column === "id" && "stock" in row) {
            state.stockUpdates.push({ id: value, stock: row.stock ?? null });
            return { error: null, count: 1 };
          }
          state.variantUpdates.push(row);
          state.activeVariantUpdates += 1;
          state.maxConcurrentVariantUpdates = Math.max(state.maxConcurrentVariantUpdates, state.activeVariantUpdates);
          await delay(state.variantUpdateDelayMs);
          state.activeVariantUpdates -= 1;
          return { error: null, count: value === "MISSING" ? 0 : 1 };
        },
      };
    },
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
