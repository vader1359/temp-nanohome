import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getUser: vi.fn(async (): Promise<{ data: { user: { id: string } | null }; error: Error | null }> => ({ data: { user: null }, error: null })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth })),
}));

import { GET } from "./route";

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  auth.getUser.mockReset();
  auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
});

describe("GET /api/customer/context", () => {
  it("does not request auth for an anonymous customer", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ visitor_id: "new-visitor", session_id: "new-session", status: "created" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify("unchanged"), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);

    const response = await GET(new Request("https://app.test/api/customer/context"));

    expect(response.status).toBe(200);
    expect(auth.getUser).not.toHaveBeenCalled();
  });

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
      .mockResolvedValueOnce(new Response(JSON.stringify("unchanged"), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);

    const response = await GET(new Request("https://app.test/api/customer/context", {
      headers: { cookie: `nano_visitor_id=${"a".repeat(64)}; nano_session_id=${"b".repeat(64)}; sb-test-auth-token=token` },
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
      "https://supabase.test/rest/v1/rpc/clear_verified_customer_identity",
      "https://supabase.test/rest/v1/rpc/current_customer_consent",
    ]);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect((await response.json()).consent.version).toBe("none");
  });

  it("binds only the user verified by Supabase auth", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { id: "00000000-0000-4000-8000-000000000061" } },
      error: null,
    });
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ visitor_id: "00000000-0000-4000-8000-000000000201", session_id: "00000000-0000-4000-8000-000000000202", status: "active" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify("bound"), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ analytics: true, personalization: true, policy_version: "2026-07" }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);

    const response = await GET(new Request("https://app.test/api/customer/context", {
      headers: { cookie: `nano_visitor_id=${"a".repeat(64)}; nano_session_id=${"b".repeat(64)}; sb-test-auth-token=token` },
    }));

    expect(response.status).toBe(200);
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      p_visitor_id: "00000000-0000-4000-8000-000000000201",
      p_session_id: "00000000-0000-4000-8000-000000000202",
      p_user_id: "00000000-0000-4000-8000-000000000061",
    });
  });

  it("fails closed when an authenticated binding cannot be persisted", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { id: "00000000-0000-4000-8000-000000000061" } },
      error: null,
    });
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ visitor_id: "00000000-0000-4000-8000-000000000201", session_id: "00000000-0000-4000-8000-000000000202", status: "active" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response("service unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);

    const response = await GET(new Request("https://app.test/api/customer/context", {
      headers: { cookie: `nano_visitor_id=${"a".repeat(64)}; nano_session_id=${"b".repeat(64)}` },
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Identity binding unavailable" });
  });
});
