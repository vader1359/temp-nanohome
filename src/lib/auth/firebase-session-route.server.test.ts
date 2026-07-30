import type { DecodedIdToken } from "firebase-admin/auth";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFirebaseSessionRouteHandlers,
  FIREBASE_CSRF_COOKIE,
  type FirebaseSessionRouteDependencies,
} from "./firebase-session-route.server";
import { FIREBASE_SESSION_COOKIE } from "./firebase-session-verifier.server";

const csrfToken = "csrf-token-with-at-least-thirty-two-characters";
const idToken = "id-token.".repeat(32);
const nowSeconds = 2_000_000_000;
const projectId = "temp-nanohome";

function decodedToken(): DecodedIdToken {
  return {
    aud: projectId,
    auth_time: nowSeconds - 5,
    exp: nowSeconds + 3_600,
    firebase: { identities: {}, sign_in_provider: "phone" },
    iat: nowSeconds - 5,
    iss: `https://securetoken.google.com/${projectId}`,
    sub: "firebase-user-01",
    uid: "firebase-user-01",
  } as DecodedIdToken;
}

describe("Firebase session route", () => {
  let verifyIdToken: ReturnType<typeof vi.fn>;
  let dependencies: FirebaseSessionRouteDependencies;

  beforeEach(() => {
    verifyIdToken = vi.fn(async () => decodedToken());
    dependencies = {
      auth: {
        verifyIdToken,
        createSessionCookie: vi.fn(async () => "opaque-session-cookie"),
      },
      createCsrfToken: () => csrfToken,
      nowSeconds: () => nowSeconds,
      projectId,
      sessionTtlSeconds: 3_600,
    };
  });

  it("issues an HttpOnly Secure CSRF cookie without caching", async () => {
    const response = await createFirebaseSessionRouteHandlers(dependencies).GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ csrfToken });
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("set-cookie")).toContain(`${FIREBASE_CSRF_COOKIE}=`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
  });

  it("exchanges only a matching CSRF request and returns a safe local redirect", async () => {
    const request = new NextRequest("https://staging.nanohome.vn/api/auth/session", {
      body: JSON.stringify({
        csrfToken,
        idToken,
        locale: "vi",
        returnTo: "/vi/account?auth=login&section=orders",
      }),
      headers: {
        "content-type": "application/json",
        cookie: `${FIREBASE_CSRF_COOKIE}=${csrfToken}`,
      },
      method: "POST",
    });

    const response = await createFirebaseSessionRouteHandlers(dependencies).POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ returnTo: "/vi/account?section=orders" });
    expect(response.headers.get("set-cookie")).toContain(`${FIREBASE_SESSION_COOKIE}=opaque-session-cookie`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });

  it("rejects a CSRF mismatch before Firebase sees the token", async () => {
    const request = new NextRequest("https://staging.nanohome.vn/api/auth/session", {
      body: JSON.stringify({ csrfToken, idToken, locale: "vi", returnTo: "/vi" }),
      headers: {
        "content-type": "application/json",
        cookie: `${FIREBASE_CSRF_COOKIE}=different-token-with-at-least-thirty-two-characters`,
      },
      method: "POST",
    });

    const response = await createFirebaseSessionRouteHandlers(dependencies).POST(request);

    expect(response.status).toBe(401);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("rejects external redirects and keeps the active locale", async () => {
    const request = new NextRequest("https://staging.nanohome.vn/api/auth/session", {
      body: JSON.stringify({
        csrfToken,
        idToken,
        locale: "ko",
        returnTo: "https://attacker.test/steal",
      }),
      headers: {
        "content-type": "application/json",
        cookie: `${FIREBASE_CSRF_COOKIE}=${csrfToken}`,
      },
      method: "POST",
    });

    const response = await createFirebaseSessionRouteHandlers(dependencies).POST(request);
    await expect(response.json()).resolves.toEqual({ returnTo: "/ko" });
  });

  it("does not set a session cookie for an incomplete checkout identity", async () => {
    const request = new NextRequest("https://staging.nanohome.vn/api/auth/session", {
      body: JSON.stringify({
        csrfToken,
        idToken,
        intent: "checkout",
        locale: "vi",
        returnTo: "/vi/checkout",
      }),
      headers: {
        "content-type": "application/json",
        cookie: `${FIREBASE_CSRF_COOKIE}=${csrfToken}`,
      },
      method: "POST",
    });

    const response = await createFirebaseSessionRouteHandlers(dependencies).POST(request);

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
