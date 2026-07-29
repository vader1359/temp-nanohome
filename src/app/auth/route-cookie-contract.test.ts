import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";

import { FirebaseSessionExchangeError } from "@/lib/auth/firebase-session-exchange.server";

const restState = vi.hoisted(() => ({
  signInWithPassword: vi.fn(async () => "firebase-id-token"),
}));

const sessionState = vi.hoisted(() => ({
  issue: vi.fn(async () => ({ value: "firebase-session", maxAge: 432_000 })),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/firebase-auth-rest-runtime.server", () => ({
  getFirebaseAuthRestClient: () => restState,
}));

vi.mock("@/lib/auth/firebase-session.server", () => ({
  issueFirebaseSessionCookie: sessionState.issue,
  applyFirebaseSessionCookie: <T extends NextResponse>(
    response: T,
    session: Readonly<{ value: string; maxAge: number }>,
  ) => {
    response.cookies.set("__Host-nanohome-session", session.value, {
      httpOnly: true,
      maxAge: session.maxAge,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
    return response;
  },
  clearFirebaseSessionCookie: <T extends NextResponse>(response: T) => {
    response.cookies.set("__Host-nanohome-session", "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
    return response;
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

afterEach(() => {
  restState.signInWithPassword.mockReset();
  restState.signInWithPassword.mockResolvedValue("firebase-id-token");
  sessionState.issue.mockReset();
  sessionState.issue.mockResolvedValue({ value: "firebase-session", maxAge: 432_000 });
});

describe("Firebase auth route cookie contract", () => {
  it("sets one hardened host-only session cookie after password sign-in", async () => {
    const { POST } = await import("./sign-in/route");

    const response = await POST(formRequest("/auth/sign-in", {
      email: "ian@example.com",
      password: "correct-password",
      locale: "en",
      redirectTo: "/en/products",
    }));

    const setCookie = response.headers.get("set-cookie");
    expect(response.headers.get("location")).toBe("https://app.test/en/products");
    expect(response.cookies.get("__Host-nanohome-session")?.value).toBe("firebase-session");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).not.toContain("sb-access-token");
  });

  it("does not set a session cookie for an unverified password identity", async () => {
    sessionState.issue.mockRejectedValue(new FirebaseSessionExchangeError("unverified_email"));
    const { POST } = await import("./sign-in/route");

    const response = await POST(formRequest("/auth/sign-in", {
      email: "ian@example.com",
      password: "correct-password",
      locale: "vi",
      redirectTo: "/vi",
    }));

    expect(response.headers.get("location")).toBe("https://app.test/vi?auth=email_not_confirmed");
    expect(response.cookies.get("__Host-nanohome-session")).toBeUndefined();
  });

  it("expires the Firebase cookie after same-origin sign-out", async () => {
    const { POST } = await import("./sign-out/route");

    const response = await POST(formRequest("/auth/sign-out", {
      locale: "en",
      redirectTo: "/en",
    }));

    expect(response.headers.get("location")).toBe("https://app.test/en");
    expect(response.cookies.get("__Host-nanohome-session")?.value).toBe("");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("set-cookie")).not.toContain("sb-access-token");
  });
});

function formRequest(path: string, fields: Readonly<Record<string, string>>): NextRequest {
  const formData = new URLSearchParams();
  Object.entries(fields).forEach(([key, value]) => formData.set(key, value));

  return new NextRequest(`https://app.test${path}`, {
    method: "POST",
    body: formData,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://app.test",
    },
  });
}
