import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getClaims: vi.fn(async () => ({ data: null, error: null })),
  getUser: vi.fn(async () => {
    throw new Error("Middleware must not fetch a fresh user for every page request");
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth }),
}));

vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}));

import middleware from "./middleware";

describe("middleware", () => {
  afterEach(() => {
    auth.getClaims.mockClear();
    auth.getUser.mockClear();
  });

  it("verifies claims without a fresh Auth user request", async () => {
    // Given: a locale page request with no session refresh required.
    const request = new NextRequest("https://app.test/vi");

    // When: middleware prepares the response.
    const response = await middleware(request);

    // Then: it uses locally verified JWT claims instead of a network user lookup.
    expect(response.status).toBe(200);
    expect(auth.getClaims).toHaveBeenCalledOnce();
    expect(auth.getUser).not.toHaveBeenCalled();
  });
});
