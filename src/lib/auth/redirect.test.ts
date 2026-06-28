import { describe, expect, it } from "vitest";

import { getSafeRedirectPath } from "./redirect";

describe("getSafeRedirectPath", () => {
  it("returns the default locale path when the redirect value is missing", () => {
    // Given: no redirect target was provided by the auth callback.
    // When: the target is parsed.
    const path = getSafeRedirectPath(null);

    // Then: the auth flow lands on the default localized home route.
    expect(path).toBe("/vi");
  });

  it("preserves a local absolute path with query and hash", () => {
    // Given: a local redirect target from the same application.
    // When: the target is parsed.
    const path = getSafeRedirectPath("/en/products?q=chair#details");

    // Then: the complete local path is preserved.
    expect(path).toBe("/en/products?q=chair#details");
  });

  it("rejects protocol-relative external redirects", () => {
    // Given: a protocol-relative attacker-controlled redirect target.
    // When: the target is parsed.
    const path = getSafeRedirectPath("//evil.example/steal");

    // Then: the flow falls back to the default locale path.
    expect(path).toBe("/vi");
  });

  it("rejects absolute external redirects", () => {
    // Given: an absolute attacker-controlled redirect target.
    // When: the target is parsed.
    const path = getSafeRedirectPath("https://evil.example/steal");

    // Then: the flow falls back to the default locale path.
    expect(path).toBe("/vi");
  });
});
