import "server-only";

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
}>): AccountAuthPort {
  return {
    async getAuthenticatedAccount() {
      const claims = await input.getClaims();
      if (claims === null || claims.uid.length === 0) return null;

      const accountId = await input.resolveAccountId(claims.uid);
      if (accountId === null) return null;

      const identities: AccountIdentity[] = [];
      if (typeof claims.email === "string" && claims.email.length > 0) {
        identities.push({
          identifier: claims.email,
          provider: "email",
          verified: claims.email_verified === true,
        });
      }
      if (typeof claims.phone_number === "string" && claims.phone_number.length > 0) {
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
          identifier: claims.email ?? "Google",
          provider: "google",
          verified: claims.email_verified === true,
        });
      }

      return {
        accountId,
        firebaseUid: claims.uid,
        identities,
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
