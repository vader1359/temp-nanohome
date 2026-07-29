import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createFirebaseAuthRestClient,
  FirebaseAuthRestError,
} from "./firebase-auth-rest.server";

describe("Firebase Auth REST adapter", () => {
  it("returns only the ID token from a bounded password exchange", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ idToken: "opaque-id-token" }));
    const client = createFirebaseAuthRestClient({
      apiKey: "public-test-key",
      fetcher: fetcher as unknown as typeof fetch,
    });

    await expect(client.signInWithPassword("ian@example.com", "password123")).resolves.toBe(
      "opaque-id-token",
    );
    expect(fetcher).toHaveBeenCalledOnce();
    const calls = fetcher.mock.calls as unknown as Array<[string, RequestInit]>;
    const [url, init] = calls[0]!;
    expect(url).toBe(
      "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=public-test-key",
    );
    expect(init).toEqual(expect.objectContaining({
      cache: "no-store",
      method: "POST",
    }));
    expect(JSON.parse(String(init.body))).toEqual({
      email: "ian@example.com",
      password: "password123",
      returnSecureToken: true,
    });
  });

  it("creates an email identity then requests Firebase-hosted verification", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ idToken: "opaque-id-token" }))
      .mockResolvedValueOnce(jsonResponse({}));
    const client = createFirebaseAuthRestClient({
      apiKey: "public-test-key",
      fetcher: fetcher as unknown as typeof fetch,
    });

    await client.signUpAndSendVerification("ian@example.com", "password123", "vi");

    expect(fetcher).toHaveBeenCalledTimes(2);
    const calls = fetcher.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls[0]?.[0]).toContain("accounts:signUp");
    expect(calls[1]?.[0]).toContain("accounts:sendOobCode");
    expect(JSON.parse(String(calls[1]?.[1].body))).toEqual({
      idToken: "opaque-id-token",
      requestType: "VERIFY_EMAIL",
    });
    expect(calls[1]?.[1].headers).toEqual(expect.objectContaining({
      "X-Firebase-Locale": "vi",
    }));
  });

  it("uses Firebase email-action endpoints for reset request and confirmation", async () => {
    const fetcher = vi.fn(async () => jsonResponse({}));
    const client = createFirebaseAuthRestClient({
      apiKey: "public-test-key",
      fetcher: fetcher as unknown as typeof fetch,
    });

    await client.sendPasswordReset("ian@example.com", "en");
    await client.confirmPasswordReset("bounded-oob-code", "new-password");

    const calls = fetcher.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls[0]?.[0]).toContain("accounts:sendOobCode");
    expect(JSON.parse(String(calls[0]?.[1].body))).toEqual({
      email: "ian@example.com",
      requestType: "PASSWORD_RESET",
    });
    expect(calls[1]?.[0]).toContain("accounts:resetPassword");
    expect(JSON.parse(String(calls[1]?.[1].body))).toEqual({
      newPassword: "new-password",
      oobCode: "bounded-oob-code",
    });
  });

  it("reduces provider failures to a stable code without retaining raw details", async () => {
    const fetcher = vi.fn(async () => jsonResponse(
      { error: { message: "INVALID_LOGIN_CREDENTIALS : raw provider detail" } },
      400,
    ));
    const client = createFirebaseAuthRestClient({
      apiKey: "public-test-key",
      fetcher: fetcher as unknown as typeof fetch,
    });

    const error = await client.signInWithPassword("ian@example.com", "wrong-password")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(FirebaseAuthRestError);
    expect(error).toMatchObject({
      code: "INVALID_LOGIN_CREDENTIALS",
      message: "INVALID_LOGIN_CREDENTIALS",
    });
    expect(String(error)).not.toContain("raw provider detail");
  });

  it("fails closed when a successful response omits the ID token", async () => {
    const fetcher = vi.fn(async () => jsonResponse({}));
    const client = createFirebaseAuthRestClient({
      apiKey: "public-test-key",
      fetcher: fetcher as unknown as typeof fetch,
    });

    await expect(client.signInWithPassword("ian@example.com", "password123")).rejects.toMatchObject({
      code: "FIREBASE_AUTH_FAILED",
    });
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
