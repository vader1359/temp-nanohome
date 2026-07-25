import { afterEach, describe, expect, it, vi } from "vitest";

import type { AmisClientConfig } from "@/lib/amis/client";
import { fetchAmisCustomers } from "@/lib/amis/customer-client";

const config: AmisClientConfig = {
  baseUrl: "https://crmconnect.misa.vn",
  clientId: "nanohome",
  clientSecret: "amis-secret",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAmisCustomers", () => {
  it("starts at page zero and returns only the restricted customer projection", async () => {
    // Given: a synthetic AMIS customer page contains fields outside the permitted projection.
    const requestedPages: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v2/Account") return Response.json({ success: true, code: 0, data: "token" });
      requestedPages.push(url.searchParams.get("page") ?? "");
      return Response.json({
        success: true,
        code: 200,
        data: [{
          id: "customer-1",
          customer_type: "retail",
          modified_date: "2026-07-10T03:00:00.000Z",
          customer_name: "Sensitive customer name",
          mobile: "0900000000",
        }],
      });
    }));

    // When: the safe Customer read port loads one short page.
    const result = await fetchAmisCustomers(config, null);

    // Then: pagination starts at zero and no raw CRM or PII fields leave the boundary.
    expect(requestedPages).toEqual(["0"]);
    expect(result).toEqual({
      kind: "success",
      records: [{ id: "customer-1", customerType: "retail", modifiedDate: "2026-07-10T03:00:00.000Z" }],
    });
  });

  it("returns a fixed failure without exposing AMIS response content", async () => {
    // Given: the synthetic AMIS Customer endpoint fails with sensitive content.
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v2/Account") return Response.json({ success: true, code: 0, data: "token" });
      return new Response("sensitive-customer-data", { status: 502 });
    }));

    // When: the read port receives the failed response.
    const result = await fetchAmisCustomers(config, null);

    // Then: the result contains only a fixed public-safe failure.
    expect(result).toEqual({ kind: "http_error", status: 502, message: "AMIS Customer read failed" });
  });
});
