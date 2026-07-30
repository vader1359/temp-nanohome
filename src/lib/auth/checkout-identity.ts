import { normalizeEmail } from "./email-normalization";
import { isE164Phone } from "./phone-e164";

export type CheckoutIdentity = Readonly<{
  readonly accountId: string;
  readonly firebaseUid: string;
  readonly verifiedEmail: string | null;
  readonly verifiedPhoneE164: string | null;
}>;

export type AuthCompletionState = "phone_required" | "identity_complete";

export type FirebaseIdentityClaims = Readonly<{
  readonly uid?: unknown;
  readonly email?: unknown;
  readonly email_verified?: unknown;
  readonly phone_number?: unknown;
}>;

export function authCompletionState(claims: FirebaseIdentityClaims): AuthCompletionState {
  const hasVerifiedPhone = isE164Phone(claims.phone_number);
  const hasVerifiedEmail = claims.email_verified === true
    && typeof claims.email === "string"
    && normalizeEmail(claims.email) !== null;

  return hasVerifiedPhone || hasVerifiedEmail
    ? "identity_complete"
    : "phone_required";
}

export function checkoutIdentityFromClaims(
  claims: FirebaseIdentityClaims,
  accountId: string | null,
): CheckoutIdentity | null {
  if (accountId === null || accountId.trim() === "") return null;
  if (typeof claims.uid !== "string" || claims.uid.trim() === "") return null;
  if (authCompletionState(claims) !== "identity_complete") return null;

  const verifiedEmail = claims.email_verified === true && typeof claims.email === "string"
    ? normalizeEmail(claims.email)
    : null;
  const verifiedPhoneE164 = isE164Phone(claims.phone_number) ? claims.phone_number : null;
  if (verifiedEmail === null && verifiedPhoneE164 === null) return null;

  return {
    accountId,
    firebaseUid: claims.uid,
    verifiedEmail,
    verifiedPhoneE164,
  };
}
