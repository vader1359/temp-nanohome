import { NextRequest, NextResponse } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}));

import proxy, { config } from "./proxy";

describe("proxy", () => {
  it("handles i18n routing without database or claims lookups", async () => {
    // Given: a locale page request
    const request = new NextRequest("https://app.test/vi");

    // When: proxy prepares the response
    const response = await proxy(request);

    // Then: it responds with 200 via handleI18nRouting
    expect(response.status).toBe(200);
  });

  it("does not localize the same-origin Firebase auth helper", () => {
    expect(unstable_doesMiddlewareMatch({
      config,
      nextConfig: {},
      url: "/__/auth/handler",
    })).toBe(false);
  });
});
