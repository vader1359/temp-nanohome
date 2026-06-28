import { describe, expect, it } from "vitest";

import { parseEmailPasswordForm } from "./credentials";

describe("parseEmailPasswordForm", () => {
  it("returns parsed credentials when email and password are valid", () => {
    // Given: a semantic auth form submission.
    const formData = new FormData();
    formData.set("email", "ian@example.com");
    formData.set("password", "correct-password");
    formData.set("redirectTo", "/en/products");

    // When: the form is parsed at the route boundary.
    const result = parseEmailPasswordForm(formData);

    // Then: typed credentials and a safe redirect path are returned.
    expect(result).toEqual({
      ok: true,
      value: {
        email: "ian@example.com",
        password: "correct-password",
        redirectTo: "/en/products",
      },
    });
  });

  it("returns invalid when email is malformed", () => {
    // Given: a malformed credential submission.
    const formData = new FormData();
    formData.set("email", "not-an-email");
    formData.set("password", "correct-password");

    // When: the form is parsed at the route boundary.
    const result = parseEmailPasswordForm(formData);

    // Then: validation fails without throwing.
    expect(result).toEqual({ ok: false });
  });

  it("sanitizes an external redirect target", () => {
    // Given: a valid credential submission with an unsafe redirect target.
    const formData = new FormData();
    formData.set("email", "ian@example.com");
    formData.set("password", "correct-password");
    formData.set("redirectTo", "https://evil.example/steal");

    // When: the form is parsed at the route boundary.
    const result = parseEmailPasswordForm(formData);

    // Then: credentials are accepted but the redirect falls back locally.
    expect(result).toEqual({
      ok: true,
      value: {
        email: "ian@example.com",
        password: "correct-password",
        redirectTo: "/vi",
      },
    });
  });
});
