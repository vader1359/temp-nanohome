import "server-only";

/**
 * Temporary Account-lane contract until Foundation publishes
 * `src/lib/auth/authenticated-account.server.ts`. This module deliberately
 * contains no Firebase, Supabase, cookie, or environment integration.
 */
export type AccountIdentityProvider = "email" | "google" | "kakao" | "phone";

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

export function createFakeAccountAuthPort(account: AuthenticatedAccount | null): AccountAuthPort {
  return {
    getAuthenticatedAccount: async () => account,
  };
}
