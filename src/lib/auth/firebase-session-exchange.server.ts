import "server-only";

import { createHash } from "node:crypto";
import type { DecodedIdToken } from "firebase-admin/auth";

import { authCompletionState } from "./checkout-identity";
import { normalizeEmail } from "./email-normalization";
import { isE164Phone } from "./phone-e164";
import type { AuthSessionIntent } from "./session-intent";
import type { AccountIdentityResolution, FirebaseIdentityResolutionInput } from "@/lib/account/identity-resolution";

export const FIREBASE_ALLOWED_SIGN_IN_PROVIDERS = ["google.com", "password", "phone"] as const;

export type FirebaseSessionIssuer = Readonly<{
  verifyIdToken: (idToken: string, checkRevoked: boolean) => Promise<DecodedIdToken>;
  createSessionCookie: (idToken: string, options: Readonly<{ expiresIn: number }>) => Promise<string>;
}>;

type AccountResolver = (input: FirebaseIdentityResolutionInput) => Promise<AccountIdentityResolution>;

export type FirebaseSessionExchangeResult = Readonly<{
  sessionCookie: string;
  firebaseUid: string;
}>;

export class FirebaseSessionExchangeError extends Error {
  constructor(readonly code: "account_resolution_failed" | "incomplete_identity" | "invalid_token" | "provider_not_allowed" | "recent_sign_in_required" | "unverified_email") {
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
  intent?: AuthSessionIntent;
  resolveAccount?: AccountResolver;
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

  if (input.intent === "checkout" && authCompletionState(decoded) !== "identity_complete") {
    throw new FirebaseSessionExchangeError("incomplete_identity");
  }

  if (input.resolveAccount !== undefined) {
    const email = decoded.email_verified === true && typeof decoded.email === "string"
      ? normalizeEmail(decoded.email)
      : null;
    const phoneE164 = isE164Phone(decoded.phone_number) ? decoded.phone_number : null;
    const idempotencyKey = createHash("sha256")
      .update([decoded.uid, String(decoded.auth_time), input.intent ?? "account", email ?? "", phoneE164 ?? ""].join("\u0000"))
      .digest("hex");
    try {
      await input.resolveAccount({
        email,
        firebaseUid: decoded.uid,
        idempotencyKey,
        intent: input.intent ?? "account",
        phoneE164,
      });
    } catch {
      throw new FirebaseSessionExchangeError("account_resolution_failed");
    }
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
