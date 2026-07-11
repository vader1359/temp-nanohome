import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const createServerClient = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient,
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  },
}));

vi.mock("@/lib/remote-read-only", () => ({
  supabaseReadOnlyFetch: vi.fn(),
}));

afterEach(() => {
  createServerClient.mockReset();
});

describe("createRouteHandlerClient", () => {
  it("applies buffered session cookies onto the returned response", async () => {
    createServerClient.mockImplementation((_url, _key, options) => {
      options.cookies.setAll([
        {
          name: "sb-access-token",
          value: "token-value",
          options: { path: "/", httpOnly: true },
        },
      ]);
      return { auth: {} };
    });

    const { createRouteHandlerClient } = await import("./route-handler");
    const request = new NextRequest("https://app.test/auth/sign-in", { method: "POST" });
    const { applyCookies } = createRouteHandlerClient(request);
    const response = applyCookies(NextResponse.redirect("https://app.test/en"));

    expect(response.cookies.get("sb-access-token")?.value).toBe("token-value");
  });

  it("forwards security and deletion options like httpOnly and maxAge into the outgoing cookies", async () => {
    createServerClient.mockImplementation((_url, _key, options) => {
      options.cookies.setAll([
        {
          name: "sb-access-token",
          value: "",
          options: { path: "/", httpOnly: true, maxAge: 0 },
        },
      ]);
      return { auth: {} };
    });

    const { createRouteHandlerClient } = await import("./route-handler");
    const request = new NextRequest("https://app.test/auth/sign-out", { method: "POST" });
    const { applyCookies } = createRouteHandlerClient(request);
    const response = applyCookies(NextResponse.redirect("https://app.test/en"));

    expect(response.cookies.get("sb-access-token")?.value).toBe("");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });
});
