import type { DecodedIdToken } from "firebase-admin/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  exchangeFirebaseIdToken,
  FirebaseSessionExchangeError,
  type FirebaseSessionIssuer,
} from "./firebase-session-exchange.server";

const nowSeconds = 2_000_000_000;
const projectId = "temp-nanohome";
const idToken = "firebase-id-token";

function claims(overrides: Partial<DecodedIdToken> = {}): DecodedIdToken {
  return {
    aud: projectId,
    auth_time: nowSeconds - 10,
    exp: nowSeconds + 3_600,
    firebase: {
      identities: {},
      sign_in_provider: "phone",
    },
    iat: nowSeconds - 10,
    iss: `https://securetoken.google.com/${projectId}`,
    sub: "firebase-user-01",
    uid: "firebase-user-01",
    ...overrides,
  } as DecodedIdToken;
}

describe("exchangeFirebaseIdToken", () => {
  let verifyIdToken: ReturnType<typeof vi.fn>;
  let createSessionCookie: ReturnType<typeof vi.fn>;
  let auth: FirebaseSessionIssuer;

  beforeEach(() => {
    verifyIdToken = vi.fn(async () => claims());
    createSessionCookie = vi.fn(async () => "opaque-session-cookie");
    auth = { verifyIdToken, createSessionCookie };
  });

  it("accepts a recent allowed Firebase identity and creates a bounded session", async () => {
    await expect(exchangeFirebaseIdToken({
      auth,
      idToken,
      nowSeconds,
      projectId,
      sessionTtlSeconds: 3_600,
    })).resolves.toEqual({
      firebaseUid: "firebase-user-01",
      sessionCookie: "opaque-session-cookie",
    });

    expect(verifyIdToken).toHaveBeenCalledWith(idToken, true);
    expect(createSessionCookie).toHaveBeenCalledWith(idToken, { expiresIn: 3_600_000 });
  });

  it.each([
    [{ aud: "production-project" }, "invalid_token"],
    [{ iss: "https://securetoken.google.com/production-project" }, "invalid_token"],
    [{ sub: "other-user" }, "invalid_token"],
    [{ auth_time: nowSeconds - 301 }, "recent_sign_in_required"],
    [{ firebase: { identities: {}, sign_in_provider: "kakao.com" } }, "provider_not_allowed"],
    [{ firebase: { identities: {}, sign_in_provider: "password" }, email_verified: false }, "unverified_email"],
  ] as const)("rejects invalid trust input %#", async (overrides, expectedCode) => {
    verifyIdToken.mockResolvedValueOnce(claims(overrides as Partial<DecodedIdToken>));

    await expect(exchangeFirebaseIdToken({
      auth,
      idToken,
      nowSeconds,
      projectId,
      sessionTtlSeconds: 3_600,
    })).rejects.toMatchObject({ code: expectedCode });
    expect(createSessionCookie).not.toHaveBeenCalled();
  });

  it("accepts verified email/password but never reads a role from the request", async () => {
    verifyIdToken.mockResolvedValueOnce(claims({
      email_verified: true,
      firebase: { identities: {}, sign_in_provider: "password" },
    }));

    await expect(exchangeFirebaseIdToken({
      auth,
      idToken,
      nowSeconds,
      projectId,
      sessionTtlSeconds: 3_600,
    })).resolves.toMatchObject({ firebaseUid: "firebase-user-01" });
  });
});
