import { describe, expect, it } from "vitest";

import { getAuthRedirectPath, getRedirectLocale, getSafeRedirectPath } from "./redirect";

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

  it("removes transient auth state while preserving local query and hash", () => {
    // Given: a post-auth redirect from an auth panel on a filtered page.
    // When: the redirect target is parsed at the server boundary.
    const path = getSafeRedirectPath("/en/products?q=chair&auth=register#details");

    // Then: the panel cannot reopen while the destination stays intact.
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

describe("getRedirectLocale", () => {
  it("returns the first supported path segment", () => {
    // Given: a localized redirect path.
    // When: the locale is extracted.
    const locale = getRedirectLocale("/ko/reset-password?status=success");

    // Then: the supported locale segment is returned.
    expect(locale).toBe("ko");
  });

  it("falls back to the default locale when the path is not localized", () => {
    // Given: an unlocalized redirect path.
    // When: the locale is extracted.
    const locale = getRedirectLocale("/products");

    // Then: the default locale is returned.
    expect(locale).toBe("vi");
  });
});

describe("getAuthRedirectPath", () => {
  it("removes the transient auth state while preserving the current route query and hash", () => {
    // Given: an auth panel URL that contains a catalog filter.
    // When: the post-auth redirect target is derived.
    const path = getAuthRedirectPath("/vi/products?category=lighting&auth=login#details");

    // Then: authentication state cannot reopen the panel after completion.
    expect(path).toBe("/vi/products?category=lighting#details");
  });
});
