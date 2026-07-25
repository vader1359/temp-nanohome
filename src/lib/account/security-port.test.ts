import { describe, expect, it } from "vitest";

import { createFakeAccountSecurityPort } from "./security-port";

const account = {
  accountId: "account_01",
  firebaseUid: "firebase_01",
  identities: [],
  locale: "vi",
} as const;

describe("createFakeAccountSecurityPort", () => {
  it("returns only masked verified identities", async () => {
    // Given: a local security port with an email sign-in method.
    const port = createFakeAccountSecurityPort();

    // When: authenticated account security is requested.
    const security = await port.getSecurity(account);

    // Then: presentation never includes the raw identifier.
    expect(security.identities).toEqual([{ provider: "email", maskedIdentifier: "m***@example.com", verified: true }]);
    expect(JSON.stringify(security)).not.toContain("mai@example.com");
  });

  it("protects the last usable sign-in method", async () => {
    // Given: the default account has only one verified method.
    const port = createFakeAccountSecurityPort({ allowsSensitiveActions: true });

    // When: the sole method is removed through the placeholder action.
    const result = await port.requestAuthAction(account, "unlink_email");

    // Then: the account retains a usable sign-in method.
    expect(result).toEqual({ kind: "last_usable_method" });
  });

  it("requires recent authentication before revoking sessions or deleting", async () => {
    // Given: the safe default port has no recent authentication proof.
    const port = createFakeAccountSecurityPort();

    // When: sensitive session and deletion actions are requested.
    const revocation = await port.revokeAllSessions(account);
    const deletion = await port.beginDeletion(account);

    // Then: both fail closed with the same recoverable state.
    expect(revocation).toEqual({ kind: "recent_authentication_required" });
    expect(deletion).toEqual({ kind: "recent_authentication_required" });
  });

  it("requires the exact DELETE phrase before confirming deletion", async () => {
    // Given: recent authentication and a started deletion flow.
    const port = createFakeAccountSecurityPort({ allowsSensitiveActions: true });
    await port.beginDeletion(account);

    // When: an incorrect confirmation is submitted.
    const rejected = await port.confirmDeletion(account, "delete");

    // Then: the destructive action is not confirmed.
    expect(rejected).toEqual({ kind: "confirmation_mismatch" });
    await expect(port.confirmDeletion(account, "DELETE")).resolves.toEqual({ kind: "deleted" });
  });
});
