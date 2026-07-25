import "server-only";

import type { AuthenticatedAccount } from "./auth-port";
import type { AccountPreferences, AccountPreferencesPatch } from "./preferences-schema";

export type AccountPreferencesActionResult =
  | { readonly kind: "updated"; readonly preferences: AccountPreferences }
  | { readonly kind: "recent_authentication_required" };

export interface AccountPreferencesPort {
  getPreferences(account: AuthenticatedAccount): Promise<AccountPreferences>;
  updatePreferences(account: AuthenticatedAccount, patch: AccountPreferencesPatch): Promise<AccountPreferences>;
  clearRecommendationData(account: AuthenticatedAccount): Promise<AccountPreferences>;
  resetAmisHistory(account: AuthenticatedAccount): Promise<AccountPreferencesActionResult>;
  disconnectAmis(account: AuthenticatedAccount): Promise<AccountPreferencesActionResult>;
}

type FakePreferencesOptions = {
  readonly allowsSensitiveActions?: boolean;
  readonly initialPreferences?: AccountPreferences;
};

const defaultPreferences: AccountPreferences = {
  amisHistory: { available: false, enabled: false },
  browsingHistoryEnabled: true,
  productPersonalizationEnabled: true,
  recommendationDataState: "available",
};

function clonePreferences(preferences: AccountPreferences): AccountPreferences {
  return {
    amisHistory: { ...preferences.amisHistory },
    browsingHistoryEnabled: preferences.browsingHistoryEnabled,
    productPersonalizationEnabled: preferences.productPersonalizationEnabled,
    recommendationDataState: preferences.recommendationDataState,
  };
}

export function createFakeAccountPreferencesPort(options: FakePreferencesOptions = {}): AccountPreferencesPort {
  const preferencesByAccountId = new Map<string, AccountPreferences>();
  const allowsSensitiveActions = options.allowsSensitiveActions ?? false;
  const initialPreferences = clonePreferences(options.initialPreferences ?? defaultPreferences);

  function preferencesFor(account: AuthenticatedAccount): AccountPreferences {
    const existing = preferencesByAccountId.get(account.accountId);
    if (existing !== undefined) {
      return existing;
    }

    const created = clonePreferences(initialPreferences);
    preferencesByAccountId.set(account.accountId, created);
    return created;
  }

  return {
    async getPreferences(account) {
      return clonePreferences(preferencesFor(account));
    },
    async updatePreferences(account, patch) {
      const next = { ...preferencesFor(account), ...patch };
      preferencesByAccountId.set(account.accountId, next);
      return clonePreferences(next);
    },
    async clearRecommendationData(account) {
      const next: AccountPreferences = { ...preferencesFor(account), recommendationDataState: "cleared" };
      preferencesByAccountId.set(account.accountId, next);
      return clonePreferences(next);
    },
    async resetAmisHistory(account) {
      if (!allowsSensitiveActions) {
        return { kind: "recent_authentication_required" };
      }

      return { kind: "updated", preferences: clonePreferences(preferencesFor(account)) };
    },
    async disconnectAmis(account) {
      if (!allowsSensitiveActions) {
        return { kind: "recent_authentication_required" };
      }

      const current = preferencesFor(account);
      const next = { ...current, amisHistory: { available: false, enabled: false } };
      preferencesByAccountId.set(account.accountId, next);
      return { kind: "updated", preferences: clonePreferences(next) };
    },
  };
}
