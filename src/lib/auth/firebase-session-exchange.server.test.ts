import type { DecodedIdToken } from "firebase-admin/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  exchangeFirebaseIdToken,
  type FirebaseSessionIssuer,
} from "./firebase-session-exchange.server";
import type { AccountIdentityResolution, FirebaseIdentityResolutionInput } from "@/lib/account/identity-resolution";

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

  it("fails closed for a checkout intent until both verified contacts are present", async () => {
    await expect(exchangeFirebaseIdToken({
      auth,
      idToken,
      intent: "checkout",
      nowSeconds,
      projectId,
      sessionTtlSeconds: 3_600,
    })).rejects.toMatchObject({ code: "incomplete_identity" });
    expect(createSessionCookie).not.toHaveBeenCalled();
  });

  it("accepts a checkout intent only with verified email and E.164 phone claims", async () => {
    verifyIdToken.mockResolvedValueOnce(claims({
      email: "person@example.test",
      email_verified: true,
      phone_number: "+84901234567",
    }));

    await expect(exchangeFirebaseIdToken({
      auth,
      idToken,
      intent: "checkout",
      nowSeconds,
      projectId,
      sessionTtlSeconds: 3_600,
    })).resolves.toMatchObject({ firebaseUid: "firebase-user-01" });
  });

  it("resolves the account before creating a session cookie", async () => {
    const resolveAccount = vi.fn<(input: FirebaseIdentityResolutionInput) => Promise<AccountIdentityResolution>>(async () => ({
      accountId: "account-owned",
      outcome: "existing_principal" as const,
    }));
    verifyIdToken.mockResolvedValueOnce(claims({
      email: "person@example.test",
      email_verified: true,
      phone_number: "+84901234567",
    }));

    await expect(exchangeFirebaseIdToken({
      auth,
      idToken,
      intent: "checkout",
      nowSeconds,
      projectId,
      resolveAccount,
      sessionTtlSeconds: 3_600,
    })).resolves.toMatchObject({ firebaseUid: "firebase-user-01" });

    expect(resolveAccount).toHaveBeenCalledWith(expect.objectContaining({
      email: "person@example.test",
      firebaseUid: "firebase-user-01",
      intent: "checkout",
      phoneE164: "+84901234567",
      idempotencyKey: expect.any(String),
    }));
    expect(resolveAccount.mock.calls[0]?.[0] ?? {}).not.toHaveProperty("idToken");
  });

  it("does not create a session cookie when account resolution fails", async () => {
    verifyIdToken.mockResolvedValueOnce(claims({
      email: "person@example.test",
      email_verified: true,
      phone_number: "+84901234567",
    }));

    await expect(exchangeFirebaseIdToken({
      auth,
      idToken,
      intent: "checkout",
      nowSeconds,
      projectId,
      resolveAccount: async () => {
        throw new Error("crm_claim_unavailable");
      },
      sessionTtlSeconds: 3_600,
    })).rejects.toMatchObject({ code: "account_resolution_failed" });
    expect(createSessionCookie).not.toHaveBeenCalled();
  });
});
