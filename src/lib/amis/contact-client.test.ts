import { afterEach, describe, expect, it, vi } from "vitest";

import type { AmisClientConfig } from "@/lib/amis/client";
import { fetchAmisContacts } from "@/lib/amis/contact-client";

const config: AmisClientConfig = {
  baseUrl: "https://crmconnect.misa.vn",
  clientId: "nanohome",
  clientSecret: "amis-secret",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAmisContacts", () => {
  it("starts at page zero and returns only the restricted contact linkage", async () => {
    // Given: a synthetic AMIS Contact page contains PII beyond the safe linkage fields.
    const requestedPages: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v2/Account") return Response.json({ success: true, code: 0, data: "token" });
      requestedPages.push(url.searchParams.get("page") ?? "");
      return Response.json({
        success: true,
        code: 200,
        data: [{
          id: "contact-1",
          customer_id: "customer-1",
          modified_date: "2026-07-10T03:00:00.000Z",
          full_name: "Sensitive contact name",
          email: "sensitive@example.test",
        }],
      });
    }));

    // When: the safe Contact read port loads one short page.
    const result = await fetchAmisContacts(config, null);

    // Then: it begins at page zero and strips raw CRM contact details.
    expect(requestedPages).toEqual(["0"]);
    expect(result).toEqual({
      kind: "success",
      records: [{ id: "contact-1", customerId: "customer-1", modifiedDate: "2026-07-10T03:00:00.000Z" }],
    });
  });

  it("returns a fixed failure without exposing AMIS response content", async () => {
    // Given: the synthetic AMIS Contact endpoint fails with sensitive content.
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v2/Account") return Response.json({ success: true, code: 0, data: "token" });
      return new Response("sensitive-contact-data", { status: 502 });
    }));

    // When: the read port receives the failed response.
    const result = await fetchAmisContacts(config, null);

    // Then: the result contains only a fixed public-safe failure.
    expect(result).toEqual({ kind: "http_error", status: 502, message: "AMIS Contact read failed" });
  });
});
