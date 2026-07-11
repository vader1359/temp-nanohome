import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthApiError, AuthSessionMissingError } from "@supabase/supabase-js";

type AuthState = {
  readonly signInWithPassword: ReturnType<typeof vi.fn>;
  readonly signUp: ReturnType<typeof vi.fn>;
  readonly signOut: ReturnType<typeof vi.fn>;
  readonly exchangeCodeForSession: ReturnType<typeof vi.fn>;
  readonly resetPasswordForEmail: ReturnType<typeof vi.fn>;
  readonly updateUser: ReturnType<typeof vi.fn>;
};

const authState = vi.hoisted<AuthState>(() => ({
  signInWithPassword: vi.fn(async () => ({ error: null })),
  signUp: vi.fn(async () => ({ error: null })),
  signOut: vi.fn(async () => ({ error: null })),
  exchangeCodeForSession: vi.fn(async () => ({ error: null })),
  resetPasswordForEmail: vi.fn(async () => ({ error: null })),
  updateUser: vi.fn(async () => ({ error: null })),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/route-handler", () => ({
  createRouteHandlerClient: vi.fn(() => ({
    supabase: { auth: authState },
    applyCookies: <T,>(response: T) => response,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

afterEach(() => {
  vi.resetModules();
  authState.signInWithPassword.mockReset();
  authState.signInWithPassword.mockResolvedValue({ error: null });
  authState.signUp.mockReset();
  authState.signUp.mockResolvedValue({ error: null });
  authState.signOut.mockReset();
  authState.signOut.mockResolvedValue({ error: null });
  authState.exchangeCodeForSession.mockReset();
  authState.exchangeCodeForSession.mockResolvedValue({ error: null });
  authState.resetPasswordForEmail.mockReset();
  authState.resetPasswordForEmail.mockResolvedValue({ error: null });
  authState.updateUser.mockReset();
  authState.updateUser.mockResolvedValue({ error: null });
});

describe("auth route handlers", () => {
  it("redirects invalid credentials to the actionable localized login state", async () => {
    // Given: a valid English login form and Supabase's invalid-credentials response.
    authState.signInWithPassword.mockResolvedValue({
      error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
    });
    const { POST } = await import("./sign-in/route");

    // When: the route handles the login form.
    const response = await POST(formRequest("/auth/sign-in", {
      email: "ian@example.com",
      password: "correct-password",
      locale: "en",
      redirectTo: "/en/products",
    }));

    // Then: the failure returns to the matching localized actionable error state.
    expect(response.headers.get("location")).toBe("https://app.test/en?auth=invalid_credentials");
  });

  it("redirects unconfirmed email sign-in to a dedicated login state", async () => {
    authState.signInWithPassword.mockResolvedValue({
      error: new AuthApiError("Email not confirmed", 400, "email_not_confirmed"),
    });
    const { POST } = await import("./sign-in/route");

    const response = await POST(formRequest("/auth/sign-in", {
      email: "ian@example.com",
      password: "correct-password",
      locale: "vi",
      redirectTo: "/vi",
    }));

    expect(response.headers.get("location")).toBe("https://app.test/vi?auth=email_not_confirmed");
  });

  it("redirects successful sign-in to the safe destination", async () => {
    const { POST } = await import("./sign-in/route");

    const response = await POST(formRequest("/auth/sign-in", {
      email: "ian@example.com",
      password: "correct-password",
      locale: "en",
      redirectTo: "/en/products",
    }));

    expect(authState.signInWithPassword).toHaveBeenCalledWith({
      email: "ian@example.com",
      password: "correct-password",
    });
    expect(response.headers.get("location")).toBe("https://app.test/en/products");
  });

  it("passes signup metadata to the auth trigger contract", async () => {
    // Given: a complete Korean signup form.
    const { POST } = await import("./sign-up/route");

    // When: the route signs up the user.
    const response = await POST(formRequest("/auth/sign-up", {
      email: "ian@example.com",
      password: "correct-password",
      confirmPassword: "correct-password",
      fullName: "Ian Nguyen",
      phone: "0900000000",
      agreeTerms: "on",
      locale: "ko",
      redirectTo: "/ko/products",
    }));

    // Then: profile fields are stored as auth user metadata for the DB trigger.
    expect(authState.signUp).toHaveBeenCalledWith({
      email: "ian@example.com",
      password: "correct-password",
      options: {
        data: {
          full_name: "Ian Nguyen",
          phone: "0900000000",
        },
        emailRedirectTo: "https://app.test/auth/callback?next=%2Fko%2Fproducts",
      },
    });
    expect(response.headers.get("location")).toBe("https://app.test/ko/check-email?signup=success");
  });

  it("returns mismatched signup passwords to the actionable registration state", async () => {
    // Given: a signup form with different password fields.
    const { POST } = await import("./sign-up/route");

    // When: the route validates the signup before calling Supabase.
    const response = await POST(formRequest("/auth/sign-up", {
      email: "ian@example.com",
      password: "correct-password",
      confirmPassword: "different-password",
      fullName: "Ian Nguyen",
      phone: "0900000000",
      agreeTerms: "on",
      locale: "vi",
      redirectTo: "/vi",
    }));

    // Then: the registration drawer receives the specific confirmation error.
    expect(authState.signUp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://app.test/vi?auth=password_mismatch");
  });

  it("sends password recovery email with localized callback target", async () => {
    // Given: a Vietnamese password recovery form.
    const { POST } = await import("./forgot-password/route");

    // When: the route requests a recovery email.
    const response = await POST(formRequest("/auth/forgot-password", {
      email: "ian@example.com",
      locale: "vi",
    }));

    // Then: Supabase gets the recovery callback and the user returns to sent state.
    expect(authState.resetPasswordForEmail).toHaveBeenCalledWith("ian@example.com", {
      redirectTo: "https://app.test/auth/callback?next=%2Fvi%2Freset-password",
    });
    expect(response.headers.get("location")).toBe("https://app.test/vi?auth=forgot_sent");
  });

  it("updates the recovery session password", async () => {
    // Given: a matching reset password form.
    const { POST } = await import("./reset-password/route");

    // When: the route updates the active recovery user.
    const response = await POST(formRequest("/auth/reset-password", {
      password: "new-password",
      confirmPassword: "new-password",
      locale: "en",
    }));

    // Then: the password update is delegated to Supabase Auth.
    expect(authState.updateUser).toHaveBeenCalledWith({ password: "new-password" });
    expect(response.headers.get("location")).toBe("https://app.test/en/reset-password?status=success");
  });

  it("returns malformed reset passwords to the editable validation state", async () => {
    // Given: a reset form has mismatched passwords.
    const { POST } = await import("./reset-password/route");

    // When: the route validates the submission before contacting Supabase.
    const response = await POST(formRequest("/auth/reset-password", {
      password: "new-password",
      confirmPassword: "different-password",
      locale: "en",
    }));

    // Then: the user is returned to a form-specific validation state.
    expect(authState.updateUser).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://app.test/en/reset-password?status=validation");
  });

  it("returns an expired recovery session to the resend state", async () => {
    // Given: the recovery session expires after the user opens the form.
    authState.updateUser.mockResolvedValue({ error: new AuthSessionMissingError() });
    const { POST } = await import("./reset-password/route");

    // When: the route submits an otherwise valid replacement password.
    const response = await POST(formRequest("/auth/reset-password", {
      password: "new-password",
      confirmPassword: "new-password",
      locale: "en",
    }));

    // Then: the user reaches the resend state instead of a generic update error.
    expect(response.headers.get("location")).toBe("https://app.test/en/reset-password?status=invalid");
  });

  it("redirects expired recovery callbacks to the localized reset state", async () => {
    // Given: an auth callback for an English destination with an expired code.
    authState.exchangeCodeForSession.mockResolvedValue({ error: new Error("expired") });
    const { GET } = await import("./callback/route");

    // When: the callback fails to exchange the code.
    const response = await GET(new Request(
      "https://app.test/auth/callback?code=expired&next=%2Fen%2Freset-password",
    ) as unknown as NextRequest);

    // Then: the user sees the expired-link recovery state with a resend action.
    expect(response.headers.get("location")).toBe("https://app.test/en/reset-password?status=invalid");
  });

  it("signs out to the submitted locale fallback", async () => {
    // Given: a sign-out form with an unsafe redirect and Korean locale.
    const { POST } = await import("./sign-out/route");

    // When: the route signs out the active session.
    const response = await POST(formRequest("/auth/sign-out", {
      locale: "ko",
      redirectTo: "https://evil.example/steal",
    }));

    // Then: the session is ended and the redirect is localized safely.
    expect(authState.signOut).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toBe("https://app.test/ko");
  });
});

function formRequest(path: string, fields: Readonly<Record<string, string>>): NextRequest {
  const formData = new URLSearchParams();

  Object.entries(fields).forEach(([key, value]) => {
    formData.set(key, value);
  });

  return new Request(`https://app.test${path}`, {
    method: "POST",
    body: formData,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  }) as unknown as NextRequest;
}
