import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";

import { FirebaseAuthRestError } from "@/lib/auth/firebase-auth-rest.server";
import { FirebaseSessionExchangeError } from "@/lib/auth/firebase-session-exchange.server";

type RestState = {
  readonly signInWithPassword: ReturnType<typeof vi.fn>;
  readonly signUpAndSendVerification: ReturnType<typeof vi.fn>;
  readonly sendPasswordReset: ReturnType<typeof vi.fn>;
  readonly confirmPasswordReset: ReturnType<typeof vi.fn>;
};

const restState = vi.hoisted<RestState>(() => ({
  signInWithPassword: vi.fn(async () => "firebase-id-token"),
  signUpAndSendVerification: vi.fn(async () => undefined),
  sendPasswordReset: vi.fn(async () => undefined),
  confirmPasswordReset: vi.fn(async () => undefined),
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
  restState.signUpAndSendVerification.mockReset();
  restState.signUpAndSendVerification.mockResolvedValue(undefined);
  restState.sendPasswordReset.mockReset();
  restState.sendPasswordReset.mockResolvedValue(undefined);
  restState.confirmPasswordReset.mockReset();
  restState.confirmPasswordReset.mockResolvedValue(undefined);
  sessionState.issue.mockReset();
  sessionState.issue.mockResolvedValue({ value: "firebase-session", maxAge: 432_000 });
});

describe("Firebase auth route handlers", () => {
  it("redirects invalid credentials to the localized login state", async () => {
    restState.signInWithPassword.mockRejectedValue(
      new FirebaseAuthRestError("INVALID_LOGIN_CREDENTIALS"),
    );
    const { POST } = await import("./sign-in/route");

    const response = await POST(formRequest("/auth/sign-in", {
      email: "ian@example.com",
      password: "correct-password",
      locale: "en",
      redirectTo: "/en/products",
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://app.test/en?auth=invalid_credentials");
    expect(sessionState.issue).not.toHaveBeenCalled();
  });

  it("rejects a password session when Firebase reports an unverified email", async () => {
    sessionState.issue.mockRejectedValue(new FirebaseSessionExchangeError("unverified_email"));
    const { POST } = await import("./sign-in/route");

    const response = await POST(formRequest("/auth/sign-in", {
      email: "ian@example.com",
      password: "correct-password",
      locale: "vi",
      redirectTo: "/vi",
    }));

    expect(response.headers.get("location")).toBe("https://app.test/vi?auth=email_not_confirmed");
  });

  it("exchanges a successful password sign-in for a server session", async () => {
    const { POST } = await import("./sign-in/route");

    const response = await POST(formRequest("/auth/sign-in", {
      email: "ian@example.com",
      password: "correct-password",
      locale: "en",
      redirectTo: "/en/products",
    }));

    expect(restState.signInWithPassword).toHaveBeenCalledWith(
      "ian@example.com",
      "correct-password",
    );
    expect(sessionState.issue).toHaveBeenCalledWith("firebase-id-token");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://app.test/en/products");
    expect(response.cookies.get("__Host-nanohome-session")?.value).toBe("firebase-session");
  });

  it("rejects cross-origin native auth posts before provider access", async () => {
    const { POST } = await import("./sign-in/route");

    const response = await POST(formRequest("/auth/sign-in", {
      email: "ian@example.com",
      password: "correct-password",
    }, "https://evil.example"));

    expect(response.status).toBe(403);
    expect(restState.signInWithPassword).not.toHaveBeenCalled();
  });

  it("creates an email identity and sends Firebase verification without profile claims", async () => {
    const { POST } = await import("./sign-up/route");

    const response = await POST(formRequest("/auth/sign-up", {
      email: "ian@example.com",
      password: "correct-password",
      confirmPassword: "correct-password",
      agreeTerms: "on",
      locale: "ko",
      redirectTo: "/ko/products",
    }));

    expect(restState.signUpAndSendVerification).toHaveBeenCalledWith(
      "ian@example.com",
      "correct-password",
      "ko",
    );
    expect(response.headers.get("location")).toBe(
      "https://app.test/ko/check-email?signup=success",
    );
    expect(response.cookies.get("__Host-nanohome-session")).toBeUndefined();
  });

  it("rejects mismatched sign-up passwords before Firebase access", async () => {
    const { POST } = await import("./sign-up/route");

    const response = await POST(formRequest("/auth/sign-up", {
      email: "ian@example.com",
      password: "correct-password",
      confirmPassword: "different-password",
      agreeTerms: "on",
      locale: "vi",
    }));

    expect(restState.signUpAndSendVerification).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://app.test/vi?auth=password_mismatch");
  });

  it("requests a localized Firebase-hosted password reset", async () => {
    const { POST } = await import("./forgot-password/route");

    const response = await POST(formRequest("/auth/forgot-password", {
      email: "ian@example.com",
      locale: "vi",
    }));

    expect(restState.sendPasswordReset).toHaveBeenCalledWith("ian@example.com", "vi");
    expect(response.headers.get("location")).toBe("https://app.test/vi?auth=forgot_sent");
  });

  it("does not reveal whether a reset email exists", async () => {
    restState.sendPasswordReset.mockRejectedValue(new FirebaseAuthRestError("EMAIL_NOT_FOUND"));
    const { POST } = await import("./forgot-password/route");

    const response = await POST(formRequest("/auth/forgot-password", {
      email: "missing@example.com",
      locale: "en",
    }));

    expect(response.headers.get("location")).toBe("https://app.test/en?auth=forgot_sent");
  });

  it("confirms a Firebase reset with the bounded email-action code", async () => {
    const { POST } = await import("./reset-password/route");

    const response = await POST(formRequest("/auth/reset-password", {
      password: "new-password",
      confirmPassword: "new-password",
      locale: "en",
      oobCode: "bounded-firebase-oob-code",
    }));

    expect(restState.confirmPasswordReset).toHaveBeenCalledWith(
      "bounded-firebase-oob-code",
      "new-password",
    );
    expect(response.headers.get("location")).toBe(
      "https://app.test/en/reset-password?status=success",
    );
  });

  it("rejects malformed reset submissions before Firebase access", async () => {
    const { POST } = await import("./reset-password/route");

    const response = await POST(formRequest("/auth/reset-password", {
      password: "new-password",
      confirmPassword: "different-password",
      locale: "en",
      oobCode: "bounded-firebase-oob-code",
    }));

    expect(restState.confirmPasswordReset).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://app.test/en/reset-password?status=validation",
    );
  });

  it("returns expired Firebase reset codes to the resend state", async () => {
    restState.confirmPasswordReset.mockRejectedValue(
      new FirebaseAuthRestError("EXPIRED_OOB_CODE"),
    );
    const { POST } = await import("./reset-password/route");

    const response = await POST(formRequest("/auth/reset-password", {
      password: "new-password",
      confirmPassword: "new-password",
      locale: "en",
      oobCode: "expired-firebase-oob-code",
    }));

    expect(response.headers.get("location")).toBe(
      "https://app.test/en/reset-password?status=invalid",
    );
  });

  it("routes Firebase reset actions but never exchanges Supabase-style codes", async () => {
    const { GET } = await import("./callback/route");

    const resetResponse = await GET(new NextRequest(
      "https://app.test/auth/callback?mode=resetPassword&oobCode=opaque-code&next=%2Fen%2Faccount",
    ));
    const legacyResponse = await GET(new NextRequest(
      "https://app.test/auth/callback?code=legacy-supabase-code&next=%2Fen%2Faccount",
    ));

    expect(resetResponse.headers.get("location")).toBe(
      "https://app.test/en/reset-password?oobCode=opaque-code",
    );
    expect(legacyResponse.headers.get("location")).toBe(
      "https://app.test/en?auth=missing_code",
    );
  });

  it("clears only the Firebase session and safely localizes sign-out", async () => {
    const { POST } = await import("./sign-out/route");

    const response = await POST(formRequest("/auth/sign-out", {
      locale: "ko",
      redirectTo: "https://evil.example/steal",
    }));

    expect(response.headers.get("location")).toBe("https://app.test/ko");
    expect(response.cookies.get("__Host-nanohome-session")?.value).toBe("");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

function formRequest(
  path: string,
  fields: Readonly<Record<string, string>>,
  origin = "https://app.test",
): NextRequest {
  const formData = new URLSearchParams();
  Object.entries(fields).forEach(([key, value]) => formData.set(key, value));

  return new NextRequest(`https://app.test${path}`, {
    method: "POST",
    body: formData,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
    },
  });
}
