import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}));

import middleware from "./middleware";

describe("middleware", () => {
  it("handles i18n routing without database or claims lookups", async () => {
    // Given: a locale page request
    const request = new NextRequest("https://app.test/vi");

    // When: middleware prepares the response
    const response = await middleware(request);

    // Then: it responds with 200 via handleI18nRouting
    expect(response.status).toBe(200);
  });
});
