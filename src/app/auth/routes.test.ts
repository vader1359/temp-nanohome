import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: authState })),
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
  it("redirects sign-in errors to the submitted locale", async () => {
    // Given: a valid English login form and a Supabase auth failure.
    authState.signInWithPassword.mockResolvedValue({ error: new Error("invalid") });
    const { POST } = await import("./sign-in/route");

    // When: the route handles the login form.
    const response = await POST(formRequest("/auth/sign-in", {
      email: "ian@example.com",
      password: "correct-password",
      locale: "en",
      redirectTo: "/en/products",
    }));

    // Then: the failure returns to the matching localized home route.
    expect(response.headers.get("location")).toBe("https://app.test/en?auth=sign_in_error");
  });

  it("passes signup metadata to the auth trigger contract", async () => {
    // Given: a complete Korean signup form.
    const { POST } = await import("./sign-up/route");

    // When: the route signs up the user.
    const response = await POST(formRequest("/auth/sign-up", {
      email: "ian@example.com",
      password: "correct-password",
      fullName: "Ian Nguyen",
      phone: "0900000000",
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
    expect(response.headers.get("location")).toBe("https://app.test/ko/products");
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

  it("redirects callback errors to the next path locale", async () => {
    // Given: an auth callback for an English destination with an expired code.
    authState.exchangeCodeForSession.mockResolvedValue({ error: new Error("expired") });
    const { GET } = await import("./callback/route");

    // When: the callback fails to exchange the code.
    const response = await GET(new Request(
      "https://app.test/auth/callback?code=expired&next=%2Fen%2Freset-password",
    ) as unknown as NextRequest);

    // Then: the user returns to the localized auth error state.
    expect(response.headers.get("location")).toBe("https://app.test/en?auth=callback_error");
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
