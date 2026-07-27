import { afterEach, describe, expect, it, vi } from "vitest";

import { createAmisClientConfig, fetchAmisStockLedger, type AmisClientConfig } from "@/lib/amis/client";
import type { Env } from "@/lib/env";
import { numericValueSchema } from "@/lib/amis/schemas";

const config: AmisClientConfig = {
  baseUrl: "https://crmconnect.misa.vn",
  clientId: "nanohome",
  clientSecret: "amis-secret",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("numericValueSchema", () => {
  it("coerces finite numeric values and rejects non-finite values", () => {
    // Given: AMIS sends numeric values as numbers or strings, including invalid values.
    const validValues = [4, "9.5"];
    const invalidValues = ["not-a-number", Number.NaN, Number.POSITIVE_INFINITY];

    // When: the AMIS numeric boundary parser processes the values.
    const parsedValues = validValues.map((value) => numericValueSchema.safeParse(value));
    const rejectedValues = invalidValues.map((value) => numericValueSchema.safeParse(value));

    // Then: finite inputs become numbers and invalid inputs fail validation.
    expect(parsedValues).toEqual([
      { success: true, data: 4 },
      { success: true, data: 9.5 },
    ]);
    expect(rejectedValues.every((result) => !result.success)).toBe(true);
  });
});

describe("createAmisClientConfig", () => {
  it.each([
    "http://crmconnect.misa.vn",
    "https://crmconnect.misa.vn.evil.example",
    "https://crmconnect.misa.vn:8443",
    "https://crmconnect.misa.vn/api/v2",
  ])("rejects an untrusted AMIS origin before a request can be made: %s", (baseUrl) => {
    // Given: credentials with a URL that is not the configured production CRM origin.
    const amisEnv = amisEnvFor(baseUrl);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // When: AMIS client configuration is created at the request boundary.
    const result = createAmisClientConfig(amisEnv);

    // Then: no usable configuration can reach a fetch call.
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("permits the configured HTTPS AMIS CRM origin", () => {
    // Given: the exact production CRM origin documented for AMIS.
    const amisEnv = amisEnvFor("https://crmconnect.misa.vn");

    // When: AMIS client configuration is created.
    const result = createAmisClientConfig(amisEnv);

    // Then: credentials are available for the trusted CRM host.
    expect(result).toEqual(config);
  });
});

function amisEnvFor(baseUrl: string): Env {
  return {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
    CRON_SECRET: "cron-test",
    AUTH_PROVIDER: "supabase",
    PAYMENT_MODE: "off",
    CHAT_ENABLED: false,
    AMIS_API_BASE_URL: baseUrl,
    AMIS_CLIENT_ID: "nanohome",
    AMIS_CLIENT_SECRET: "amis-secret",
  };
}

describe("fetchAmisStockLedger", () => {
  it("fetches every ledger page and parses finite numeric order quantities", async () => {
    // Given: AMIS returns two ledger pages with numeric and numeric-string order quantities.
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
          data: [{ product_code: "SKU-1", order_quantity: "4", amount_summary: 0 }],
        });
      }

      return Response.json({
        success: false,
        code: 0,
        total_pages: 2,
        data: [
          { product_code: "SKU-1", order_quantity: 7, amount_summary: 0 },
          { product_code: "SKU-2", order_quantity: 9, amount_summary: 0 },
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
