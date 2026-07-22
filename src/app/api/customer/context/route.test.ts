import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/customer/context", () => {
  it("fails closed when identity persistence is unavailable", async () => {
    const response = await GET(new Request("https://app.test/api/customer/context"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "Identity unavailable" });
  });

  it("clears inactive cookies before issuing a persisted replacement pair", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ visitor_id: "old-visitor", session_id: "old-session", status: "inactive" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ visitor_id: "new-visitor", session_id: "new-session", status: "created" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);

    const response = await GET(new Request("https://app.test/api/customer/context", {
      headers: { cookie: `nano_visitor_id=${"a".repeat(64)}; nano_session_id=${"b".repeat(64)}` },
    }));

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toMatch(/nano_visitor_id=[0-9a-f]{64}/);
    expect(setCookie).toMatch(/nano_session_id=[0-9a-f]{64}/);
    expect(setCookie).not.toContain("a".repeat(64));
    expect(setCookie).not.toContain("b".repeat(64));
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      "https://supabase.test/rest/v1/rpc/resolve_customer_identity_v2",
      "https://supabase.test/rest/v1/rpc/bootstrap_customer_identity_v2",
      "https://supabase.test/rest/v1/rpc/current_customer_consent",
    ]);
  });
});
