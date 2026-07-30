import type { AuthenticatedAccount } from "@/lib/account/auth-port";

const E164_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/u;

export type CheckoutIdentity = Readonly<{
  accountId: string;
  firebaseUid: string;
  verifiedEmail: string;
  verifiedPhoneE164: string;
}>;

export type CheckoutIdentityResolution =
  | Readonly<{ kind: "ready"; identity: CheckoutIdentity }>
  | Readonly<{
      kind: "identity_required";
      missing: readonly ("email" | "phone")[];
    }>;

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
    && /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(identity.identifier.trim()),
  );
  const verifiedPhoneIdentity = account.identities.find((identity) =>
    identity.provider === "phone" && identity.verified,
  );
  const verifiedEmail = verifiedEmailIdentity?.identifier.trim().toLowerCase() ?? null;
  const verifiedPhoneE164 = verifiedPhoneIdentity === undefined
    ? null
    : normalizeVerifiedE164Phone(verifiedPhoneIdentity.identifier);
  const missing: ("email" | "phone")[] = [];
  if (verifiedEmail === null) missing.push("email");
  if (verifiedPhoneE164 === null) missing.push("phone");
  if (missing.length > 0 || verifiedEmail === null || verifiedPhoneE164 === null) {
    return { kind: "identity_required", missing };
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
