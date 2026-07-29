import "server-only";

import type { AccountIdentityProvider, AuthenticatedAccount } from "./auth-port";
import type { ProfilePatch } from "./profile-schema";
import type { StoredAccountProfile } from "./account-data-repository.server";

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

export function createAccountProfilePort(repository: Readonly<{
  readonly getProfile: (accountId: string) => Promise<StoredAccountProfile | null>;
  readonly patchProfile: (accountId: string, patch: ProfilePatch) => Promise<StoredAccountProfile>;
}>): AccountProfilePort {
  const present = (
    account: AuthenticatedAccount,
    stored: StoredAccountProfile | null,
  ): AccountProfile => {
    const identityProfile = createProfile(account);
    return {
      ...identityProfile,
      ...(stored ?? {}),
      locale: stored?.locale ?? account.locale,
    };
  };

  return {
    getProfile: async (account) => present(
      account,
      await repository.getProfile(account.accountId),
    ),
    patchProfile: async (account, patch) => present(
      account,
      await repository.patchProfile(account.accountId, patch),
    ),
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
