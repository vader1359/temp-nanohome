import "server-only";

import { normalizeEmail } from "@/lib/auth/email-normalization";
import { isE164Phone } from "@/lib/auth/phone-e164";

export type AccountIdentityProvider = "email" | "google" | "phone";

export type AccountIdentity = Readonly<{
  readonly provider: AccountIdentityProvider;
  readonly identifier: string;
  readonly verified: boolean;
}>;

export type AuthenticatedAccount = Readonly<{
  readonly accountId: string;
  readonly firebaseUid: string;
  readonly locale: string;
  readonly identities: readonly AccountIdentity[];
}>;

export interface AccountAuthPort {
  readonly getAuthenticatedAccount: () => Promise<AuthenticatedAccount | null>;
}

type VerifiedContactKind = "email" | "phone";

export type FirebaseAccountClaims = Readonly<{
  readonly uid: string;
  readonly email?: string;
  readonly email_verified?: boolean;
  readonly phone_number?: string;
  readonly firebase?: Readonly<{
    readonly identities?: Readonly<Record<string, unknown>>;
    readonly sign_in_provider?: string;
  }>;
}>;

export function createFirebaseAccountAuthPort(input: Readonly<{
  readonly getClaims: () => Promise<FirebaseAccountClaims | null>;
  readonly getLocale: () => Promise<string>;
  readonly resolveAccountId: (firebaseUid: string) => Promise<string | null>;
  readonly resolveVerifiedContactKinds?: (accountId: string) => Promise<readonly VerifiedContactKind[]>;
}>): AccountAuthPort {
  return {
    async getAuthenticatedAccount() {
      const claims = await input.getClaims();
      if (claims === null || claims.uid.length === 0) return null;

      const accountId = await input.resolveAccountId(claims.uid);
      if (accountId === null) return null;

      const identities: AccountIdentity[] = [];
      const normalizedEmail = typeof claims.email === "string" ? normalizeEmail(claims.email) : null;
      if (normalizedEmail !== null) {
        identities.push({
          identifier: normalizedEmail,
          provider: "email",
          verified: claims.email_verified === true,
        });
      }
      if (isE164Phone(claims.phone_number)) {
        identities.push({
          identifier: claims.phone_number,
          provider: "phone",
          verified: true,
        });
      }
      const provider = claims.firebase?.sign_in_provider;
      const hasGoogleIdentity = provider === "google.com"
        || Object.prototype.hasOwnProperty.call(claims.firebase?.identities ?? {}, "google.com");
      if (hasGoogleIdentity) {
        identities.push({
          identifier: normalizedEmail ?? "Google",
          provider: "google",
          verified: claims.email_verified === true && normalizedEmail !== null,
        });
      }

      const canonicalContactKinds = input.resolveVerifiedContactKinds === undefined
        ? null
        : new Set(await input.resolveVerifiedContactKinds(accountId));
      const presentedIdentities = canonicalContactKinds === null
        ? identities
        : identities.filter((identity) => identity.provider === "google"
          || canonicalContactKinds.has(identity.provider as VerifiedContactKind));

      return {
        accountId,
        firebaseUid: claims.uid,
        identities: presentedIdentities,
        locale: await input.getLocale(),
      };
    },
  };
}

export function createFakeAccountAuthPort(account: AuthenticatedAccount | null): AccountAuthPort {
  return {
    getAuthenticatedAccount: async () => account,
  };
}
