import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthApiError } from "@supabase/supabase-js";
import { NextRequest, type NextResponse } from "next/server";
import { type CookieOptions } from "@supabase/ssr";

type AuthState = {
  readonly signInWithPassword: ReturnType<typeof vi.fn>;
  readonly signOut: ReturnType<typeof vi.fn>;
};

const authState = vi.hoisted<AuthState>(() => ({
  signInWithPassword: vi.fn(async () => ({ error: null })),
  signOut: vi.fn(async () => ({ error: null })),
}));

type CookieState = {
  value: string | undefined;
  options: CookieOptions | undefined;
};

const cookieState = vi.hoisted<CookieState>(
  () => ({ value: undefined, options: undefined }),
);

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/route-handler", () => ({
  createRouteHandlerClient: vi.fn(() => ({
    supabase: { auth: authState },
    applyCookies: <T extends NextResponse>(response: T) => {
      if (cookieState.value !== undefined) {
        response.cookies.set("sb-access-token", cookieState.value, {
          path: "/",
          ...cookieState.options,
        });
      }
      return response;
    },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

afterEach(() => {
  vi.resetModules();
  authState.signInWithPassword.mockReset();
  authState.signInWithPassword.mockResolvedValue({ error: null });
  authState.signOut.mockReset();
  authState.signOut.mockResolvedValue({ error: null });
  cookieState.value = undefined;
  cookieState.options = undefined;
});

describe("auth route cookie contracts", () => {
  it("returns the session cookie on a successful password sign-in redirect", async () => {
    cookieState.value = "session-token";
    cookieState.options = { path: "/", httpOnly: true };
    const { POST } = await import("./sign-in/route");

    const response = await POST(formRequest("/auth/sign-in", {
      email: "ian@example.com",
      password: "correct-password",
      locale: "en",
      redirectTo: "/en/products",
    }));

    expect(response.headers.get("location")).toBe("https://app.test/en/products");
    expect(response.cookies.get("sb-access-token")?.value).toBe("session-token");
  });

  it("does not return a session cookie for an unconfirmed email", async () => {
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
    expect(response.cookies.get("sb-access-token")).toBeUndefined();
  });

  it("returns Supabase's cleared session cookie after sign-out", async () => {
    cookieState.value = "";
    cookieState.options = { path: "/", maxAge: 0 };
    const { POST } = await import("./sign-out/route");

    const response = await POST(formRequest("/auth/sign-out", {
      locale: "en",
      redirectTo: "/en",
    }));

    expect(response.headers.get("location")).toBe("https://app.test/en");
    expect(response.cookies.get("sb-access-token")?.value).toBe("");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

function formRequest(path: string, fields: Readonly<Record<string, string>>): NextRequest {
  const formData = new URLSearchParams();

  Object.entries(fields).forEach(([key, value]) => {
    formData.set(key, value);
  });

  return new NextRequest(`https://app.test${path}`, {
    method: "POST",
    body: formData,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}
