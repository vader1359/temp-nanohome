import { describe, expect, it } from "vitest";

import {
  parseEmailPasswordForm,
  parseForgotPasswordForm,
  parseResetPasswordForm,
  parseSignUpForm,
} from "./credentials";

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
        locale: "vi",
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
    formData.set("confirmPassword", "correct-password");
    formData.set("agreeTerms", "on");
    formData.set("redirectTo", "https://evil.example/steal");

    // When: the form is parsed at the route boundary.
    const result = parseEmailPasswordForm(formData);

    // Then: credentials are accepted but the redirect falls back locally.
    expect(result).toEqual({
      ok: true,
      value: {
        email: "ian@example.com",
        password: "correct-password",
        locale: "vi",
        redirectTo: "/vi",
      },
    });
  });
});

describe("parseSignUpForm", () => {
  it("returns trigger metadata when signup fields are valid", () => {
    // Given: a complete sign-up form submission.
    const formData = new FormData();
    formData.set("email", "ian@example.com");
    formData.set("password", "correct-password");
    formData.set("fullName", "Ian Nguyen");
    formData.set("phone", "0900000000");
    formData.set("confirmPassword", "correct-password");
    formData.set("agreeTerms", "on");
    formData.set("locale", "en");
    formData.set("redirectTo", "/en/products");

    // When: the form is parsed at the route boundary.
    const result = parseSignUpForm(formData);

    // Then: metadata matches the database auth.users trigger contract.
    expect(result).toEqual({
      ok: true,
      value: {
        email: "ian@example.com",
        password: "correct-password",
        fullName: "Ian Nguyen",
        phone: "0900000000",
        locale: "en",
        redirectTo: "/en/products",
      },
    });
  });

  it("returns invalid when required profile metadata is missing", () => {
    // Given: a sign-up form without profile fields.
    const formData = new FormData();
    formData.set("email", "ian@example.com");
    formData.set("password", "correct-password");
    formData.set("confirmPassword", "correct-password");
    formData.set("agreeTerms", "on");

    // When: the form is parsed at the route boundary.
    const result = parseSignUpForm(formData);

    // Then: validation fails before Supabase is called.
    expect(result).toEqual({ ok: false, error: "invalid" });
  });

  it("returns invalid when the signup password confirmation differs", () => {
    // Given: a complete signup form with a mismatched confirmation password.
    const formData = new FormData();
    formData.set("email", "ian@example.com");
    formData.set("password", "correct-password");
    formData.set("confirmPassword", "different-password");
    formData.set("fullName", "Ian Nguyen");
    formData.set("phone", "0900000000");
    formData.set("agreeTerms", "on");

    // When: the form is parsed at the route boundary.
    const result = parseSignUpForm(formData);

    // Then: Supabase cannot receive the inconsistent registration.
    expect(result).toEqual({ ok: false, error: "password_mismatch" });
  });

  it("returns invalid when the signup terms are not accepted", () => {
    // Given: a complete signup form without terms acceptance.
    const formData = new FormData();
    formData.set("email", "ian@example.com");
    formData.set("password", "correct-password");
    formData.set("confirmPassword", "correct-password");
    formData.set("fullName", "Ian Nguyen");
    formData.set("phone", "0900000000");

    // When: the form is parsed at the route boundary.
    const result = parseSignUpForm(formData);

    // Then: Supabase cannot receive an unaccepted terms agreement.
    expect(result).toEqual({ ok: false, error: "terms_required" });
  });
});

describe("parseForgotPasswordForm", () => {
  it("returns email, locale, and redirect target when valid", () => {
    // Given: a forgot-password form submission from the Korean locale.
    const formData = new FormData();
    formData.set("email", "ian@example.com");
    formData.set("locale", "ko");

    // When: the form is parsed at the route boundary.
    const result = parseForgotPasswordForm(formData);

    // Then: the recovery flow has a localized target.
    expect(result).toEqual({
      ok: true,
      value: {
        email: "ian@example.com",
        locale: "ko",
        redirectTo: "/ko/reset-password",
      },
    });
  });
});

describe("parseResetPasswordForm", () => {
  it("returns the new password and locale when passwords match", () => {
    // Given: a valid reset-password form submission.
    const formData = new FormData();
    formData.set("password", "new-password");
    formData.set("confirmPassword", "new-password");
    formData.set("locale", "en");

    // When: the form is parsed at the route boundary.
    const result = parseResetPasswordForm(formData);

    // Then: a typed password update request is returned.
    expect(result).toEqual({
      ok: true,
      value: {
        password: "new-password",
        locale: "en",
        redirectTo: "/en/reset-password?status=success",
      },
    });
  });

  it("returns invalid when passwords do not match", () => {
    // Given: a reset form with mismatched password confirmation.
    const formData = new FormData();
    formData.set("password", "new-password");
    formData.set("confirmPassword", "different-password");

    // When: the form is parsed at the route boundary.
    const result = parseResetPasswordForm(formData);

    // Then: validation fails before Supabase is called.
    expect(result).toEqual({ ok: false });
  });
});
