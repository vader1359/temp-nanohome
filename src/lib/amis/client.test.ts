import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchAmisStockLedger, type AmisClientConfig } from "@/lib/amis/client";

const config: AmisClientConfig = {
  baseUrl: "https://amis.example.test",
  clientId: "nanohome",
  clientSecret: "amis-secret",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAmisStockLedger", () => {
  it("fetches every ledger page and parses finite numeric amount summaries", async () => {
    // Given: AMIS returns two ledger pages with numeric and numeric-string amounts.
    const ledgerPages: string[] = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));

      if (url.pathname === "/api/v2/Account") {
        return Response.json({ success: true, code: 0, data: "access-token" });
      }

      expect(url.pathname).toBe("/api/v2/Stocks/product_ledger");
      expect(init?.method).toBe("GET");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer access-token");
      expect(new Headers(init?.headers).get("Clientid")).toBe("nanohome");
      expect(url.searchParams.get("pageSize")).toBe("50");
      expect(url.searchParams.has("stockID")).toBe(false);
      const page = url.searchParams.get("page");
      ledgerPages.push(page ?? "");
      if (page === "1") {
        return Response.json({
          success: false,
          code: 0,
          total_pages: 2,
          data: [{ product_code: "SKU-1", amount_summary: "4" }],
        });
      }

      return Response.json({
        success: false,
        code: 0,
        total_pages: 2,
        data: [
          { product_code: "SKU-1", amount_summary: 7 },
          { product_code: "SKU-2", amount_summary: 9 },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    // When: the complete stock ledger snapshot is fetched.
    const result = await fetchAmisStockLedger(config);

    // Then: records from every page are returned as numbers with duplicate SKUs removed.
    expect(result).toEqual({
      kind: "success",
      records: [{ sku: "SKU-2", stock: 9 }],
    });
    expect(ledgerPages).toEqual(["1", "2"]);
  });
});
