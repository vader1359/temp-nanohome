import { describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
  getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth })),
}));

import { GET } from "./route";

describe("GET /api/customer/personalization", () => {
  it("returns a private no-store response when authentication is absent", async () => {
    const response = await GET(new Request("https://app.test/api/customer/personalization?locale=en"));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("vary")).toBe("Cookie");
    await expect(response.json()).resolves.toEqual({ error: "Authentication required" });
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("rejects an unsupported locale before touching authentication", async () => {
    auth.getUser.mockClear();

    const response = await GET(new Request("https://app.test/api/customer/personalization?locale=fr"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Unsupported locale" });
    expect(auth.getUser).not.toHaveBeenCalled();
  });
});
