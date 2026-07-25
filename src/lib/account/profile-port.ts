import "server-only";

import type { AccountIdentityProvider, AuthenticatedAccount } from "./auth-port";
import type { ProfilePatch } from "./profile-schema";

export type AccountProviderMetadata = Readonly<{
  readonly provider: AccountIdentityProvider;
  readonly identifier: string;
}>;

export type AccountProfile = Readonly<{
  readonly fullName: string | null;
  readonly dateOfBirth: string | null;
  readonly nationality: string | null;
  readonly formOfAddress: string | null;
  readonly locale: string | null;
  readonly primaryEmail: string | null;
  readonly primaryPhone: string | null;
  readonly providerMetadata: readonly AccountProviderMetadata[];
}>;

export interface AccountProfilePort {
  readonly getProfile: (account: AuthenticatedAccount) => Promise<AccountProfile>;
  readonly patchProfile: (account: AuthenticatedAccount, patch: ProfilePatch) => Promise<AccountProfile>;
}

function createProfile(account: AuthenticatedAccount): AccountProfile {
  const verifiedEmail = account.identities.find((identity) => identity.provider === "email" && identity.verified);
  const verifiedPhone = account.identities.find((identity) => identity.provider === "phone" && identity.verified);
  const providerMetadata = account.identities
    .filter((identity) => !identity.verified)
    .map((identity) => ({ provider: identity.provider, identifier: identity.identifier }));

  return {
    fullName: null,
    dateOfBirth: null,
    nationality: null,
    formOfAddress: null,
    locale: account.locale,
    primaryEmail: verifiedEmail?.identifier ?? null,
    primaryPhone: verifiedPhone?.identifier ?? null,
    providerMetadata,
  };
}

export function createFakeAccountProfilePort(): AccountProfilePort {
  const profiles = new Map<string, AccountProfile>();

  function getOrCreateProfile(account: AuthenticatedAccount): AccountProfile {
    const currentProfile = profiles.get(account.accountId);
    if (currentProfile !== undefined) {
      return currentProfile;
    }

    const profile = createProfile(account);
    profiles.set(account.accountId, profile);
    return profile;
  }

  return {
    getProfile: async (account) => getOrCreateProfile(account),
    patchProfile: async (account, patch) => {
      const profile = { ...getOrCreateProfile(account), ...patch };
      profiles.set(account.accountId, profile);
      return profile;
    },
  };
}
