import { describe, expect, it } from "vitest";

import type { AuthenticatedAccount } from "./auth-port";
import { createFakeAccountPreferencesPort } from "./preferences-port";

const account: AuthenticatedAccount = {
  accountId: "account_01",
  firebaseUid: "firebase_01",
  identities: [],
  locale: "vi",
};

describe("fake account preferences port", () => {
  it("returns a canonical updated preference on the next read", async () => {
    // Given: an account-scoped fake preferences port.
    const port = createFakeAccountPreferencesPort();

    // When: the account disables browsing history.
    await port.updatePreferences(account, { browsingHistoryEnabled: false });

    // Then: its immediate next read returns the changed canonical DTO.
    await expect(port.getPreferences(account)).resolves.toMatchObject({ browsingHistoryEnabled: false });
  });

  it("requires recent authentication before AMIS disconnection by default", async () => {
    // Given: the default fake sensitive-action policy.
    const port = createFakeAccountPreferencesPort();

    // When: the account requests AMIS disconnection.
    const result = await port.disconnectAmis(account);

    // Then: no AMIS data is exposed and reauthentication is required.
    expect(result).toEqual({ kind: "recent_authentication_required" });
  });

  it("disconnects seeded AMIS history after recent authentication", async () => {
    // Given: a seeded authorized fake with AMIS history available.
    const port = createFakeAccountPreferencesPort({
      allowsSensitiveActions: true,
      initialPreferences: {
        amisHistory: { available: true, enabled: true },
        browsingHistoryEnabled: true,
        productPersonalizationEnabled: true,
        recommendationDataState: "available",
      },
    });

    // When: the account disconnects AMIS history.
    const result = await port.disconnectAmis(account);

    // Then: the safe DTO proves the available state transitioned.
    expect(result).toEqual({
      kind: "updated",
      preferences: {
        amisHistory: { available: false, enabled: false },
        browsingHistoryEnabled: true,
        productPersonalizationEnabled: true,
        recommendationDataState: "available",
      },
    });
  });
});
