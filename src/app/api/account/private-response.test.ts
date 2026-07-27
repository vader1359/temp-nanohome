import { describe, expect, it, vi } from "vitest";

import { withPrivateErrorBoundary } from "./private-response";

describe("withPrivateErrorBoundary", () => {
  it("returns a generic private response when a handler rejects", async () => {
    // Given: an Account handler whose port rejects with sensitive details.
    const handler = vi.fn(async (): Promise<Response> => Promise.reject(new Error("database credential failure")));

    // When: the handler executes at the private API boundary.
    const response = await withPrivateErrorBoundary(handler)();

    // Then: callers receive only a non-cacheable generic failure.
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("vary")).toBe("Cookie");
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
