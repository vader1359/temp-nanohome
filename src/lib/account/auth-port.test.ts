import { describe, expect, it } from "vitest";

import { createFakeAccountAuthPort } from "./auth-port";

describe("createFakeAccountAuthPort", () => {
  it("returns the configured authenticated account", async () => {
    // Given: a fake with a verified customer account.
    const account = {
      accountId: "account_01",
      firebaseUid: "firebase_01",
      locale: "vi",
      identities: [],
    } as const;
    const port = createFakeAccountAuthPort(account);

    // When: the Account lane resolves the current account.
    const result = await port.getAuthenticatedAccount();

    // Then: it receives the configured identity without a Foundation dependency.
    expect(result).toEqual(account);
  });

  it("returns null for an anonymous fixture", async () => {
    // Given: a fake without an authenticated account.
    const port = createFakeAccountAuthPort(null);

    // When: the Account lane resolves the current account.
    const result = await port.getAuthenticatedAccount();

    // Then: it receives the anonymous result.
    expect(result).toBeNull();
  });
});
