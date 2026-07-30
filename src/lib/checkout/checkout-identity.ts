import type { AuthenticatedAccount } from "@/lib/account/auth-port";
import { normalizeEmail } from "@/lib/auth/email-normalization";
import { normalizeInternationalPhone } from "@/lib/auth/phone-e164";

const E164_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/u;

export type CheckoutIdentity = Readonly<{
  accountId: string;
  firebaseUid: string;
  verifiedEmail: string | null;
  verifiedPhoneE164: string | null;
}>;

export type CheckoutIdentityResolution =
  | Readonly<{ kind: "ready"; identity: CheckoutIdentity }>
  | Readonly<{
      kind: "identity_required";
      missing: readonly ("email" | "phone")[];
    }>;

export type CheckoutOrderContactResolution =
  | Readonly<{
      kind: "ready";
      contact: Readonly<{
        email: string;
        phoneE164: string;
      }>;
    }>
  | Readonly<{ kind: "invalid_contact" }>
  | Readonly<{ kind: "verified_contact_mismatch" }>;

export function normalizeVerifiedE164Phone(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/gu, "");
  return E164_PHONE_PATTERN.test(compact) ? compact : null;
}

export function resolveCheckoutIdentity(
  account: AuthenticatedAccount,
): CheckoutIdentityResolution {
  const verifiedEmailIdentity = account.identities.find((identity) =>
    identity.verified
    && (identity.provider === "email" || identity.provider === "google")
    && normalizeEmail(identity.identifier) !== null,
  );
  const verifiedPhoneIdentity = account.identities.find((identity) =>
    identity.provider === "phone" && identity.verified,
  );
  const verifiedEmail = verifiedEmailIdentity === undefined
    ? null
    : normalizeEmail(verifiedEmailIdentity.identifier);
  const verifiedPhoneE164 = verifiedPhoneIdentity === undefined
    ? null
    : normalizeVerifiedE164Phone(verifiedPhoneIdentity.identifier);
  if (verifiedEmail === null && verifiedPhoneE164 === null) {
    return { kind: "identity_required", missing: ["email", "phone"] };
  }

  return {
    identity: {
      accountId: account.accountId,
      firebaseUid: account.firebaseUid,
      verifiedEmail,
      verifiedPhoneE164,
    },
    kind: "ready",
  };
}

export function resolveCheckoutOrderContact(
  identity: CheckoutIdentity,
  input: Readonly<{ email: string; phone: string }>,
): CheckoutOrderContactResolution {
  const email = normalizeEmail(input.email);
  const phoneE164 = normalizeInternationalPhone(input.phone);
  if (email === null || phoneE164 === null) {
    return { kind: "invalid_contact" };
  }
  if (
    (identity.verifiedEmail !== null && identity.verifiedEmail !== email)
    || (
      identity.verifiedPhoneE164 !== null
      && identity.verifiedPhoneE164 !== phoneE164
    )
  ) {
    return { kind: "verified_contact_mismatch" };
  }
  return {
    contact: { email, phoneE164 },
    kind: "ready",
  };
}
