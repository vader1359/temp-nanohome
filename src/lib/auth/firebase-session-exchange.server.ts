import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";

export const FIREBASE_ALLOWED_SIGN_IN_PROVIDERS = ["google.com", "password", "phone"] as const;

export type FirebaseSessionIssuer = Readonly<{
  verifyIdToken: (idToken: string, checkRevoked: boolean) => Promise<DecodedIdToken>;
  createSessionCookie: (idToken: string, options: Readonly<{ expiresIn: number }>) => Promise<string>;
}>;

export type FirebaseSessionExchangeResult = Readonly<{
  sessionCookie: string;
  firebaseUid: string;
}>;

export class FirebaseSessionExchangeError extends Error {
  constructor(readonly code: "invalid_token" | "provider_not_allowed" | "recent_sign_in_required" | "unverified_email") {
    super(code);
    this.name = "FirebaseSessionExchangeError";
  }
}

export async function exchangeFirebaseIdToken(input: Readonly<{
  auth: FirebaseSessionIssuer;
  idToken: string;
  nowSeconds: number;
  projectId: string;
  sessionTtlSeconds: number;
}>): Promise<FirebaseSessionExchangeResult> {
  let decoded: DecodedIdToken;
  try {
    decoded = await input.auth.verifyIdToken(input.idToken, true);
  } catch {
    throw new FirebaseSessionExchangeError("invalid_token");
  }

  const expectedIssuer = `https://securetoken.google.com/${input.projectId}`;
  if (
    decoded.aud !== input.projectId
    || decoded.iss !== expectedIssuer
    || decoded.sub.length === 0
    || decoded.sub !== decoded.uid
  ) {
    throw new FirebaseSessionExchangeError("invalid_token");
  }

  if (
    typeof decoded.auth_time !== "number"
    || decoded.auth_time > input.nowSeconds + 30
    || input.nowSeconds - decoded.auth_time > 300
  ) {
    throw new FirebaseSessionExchangeError("recent_sign_in_required");
  }

  const provider = decoded.firebase?.sign_in_provider;
  if (!FIREBASE_ALLOWED_SIGN_IN_PROVIDERS.includes(provider as (typeof FIREBASE_ALLOWED_SIGN_IN_PROVIDERS)[number])) {
    throw new FirebaseSessionExchangeError("provider_not_allowed");
  }

  if (provider === "password" && decoded.email_verified !== true) {
    throw new FirebaseSessionExchangeError("unverified_email");
  }

  try {
    return {
      sessionCookie: await input.auth.createSessionCookie(input.idToken, {
        expiresIn: input.sessionTtlSeconds * 1_000,
      }),
      firebaseUid: decoded.uid,
    };
  } catch {
    throw new FirebaseSessionExchangeError("invalid_token");
  }
}
