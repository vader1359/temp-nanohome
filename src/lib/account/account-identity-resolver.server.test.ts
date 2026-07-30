import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  AccountIdentityResolutionError,
  createAccountIdentityResolver,
} from "./account-identity-resolver.server";
import type { AccountIdentityResolution } from "./identity-resolution";

const secret = "identity-lookup-secret-with-32-bytes";
const identity = {
  email: "person@example.test",
  firebaseUid: "firebase-user-01",
  idempotencyKey: "firebase-user-01:auth-time:checkout",
  intent: "checkout" as const,
  phoneE164: "+84901234567",
};

function createRepository() {
  return {
    resolveOrCreateAccount: vi.fn<() => Promise<AccountIdentityResolution>>(
      async () => ({ accountId: "account-created", outcome: "created" }),
    ),
  };
}

describe("account identity resolver", () => {
  it("returns a Customers-only CRM claim without invoking fallback creation", async () => {
    const repository = createRepository();
    const resolveCustomerClaim = vi.fn(async () => ({
      accountId: "account-crm",
      assurance: {
        checkoutReady: true,
        emailVerified: true,
        phoneVerified: true,
        registrationClaimed: true,
      },
      status: "claimed" as const,
    }));
    const resolver = createAccountIdentityResolver({
      lookupSecret: secret,
      repository,
      resolveCustomerClaim,
    });

    await expect(resolver.resolveOrCreate(identity)).resolves.toEqual({
      accountId: "account-crm",
      outcome: "crm_claimed",
    });
    expect(resolveCustomerClaim).toHaveBeenCalledWith({
      emailVerified: true,
      firebaseUid: identity.firebaseUid,
      phoneVerified: true,
      verifiedEmail: identity.email,
      verifiedPhoneE164: identity.phoneE164,
    });
    expect(repository.resolveOrCreateAccount).not.toHaveBeenCalled();
  });

  it("replays a phone-only Firebase principal as checkout-ready", async () => {
    const repository = createRepository();
    const resolver = createAccountIdentityResolver({
      lookupSecret: secret,
      repository,
      resolveCustomerClaim: async () => ({
        accountId: "account-existing",
        assurance: {
          checkoutReady: true,
          emailVerified: false,
          phoneVerified: true,
          registrationClaimed: true,
        },
        status: "already_claimed",
      }),
    });

    await expect(resolver.resolveOrCreate({
      ...identity,
      email: null,
      intent: "checkout",
    })).resolves.toEqual({
      accountId: "account-existing",
      outcome: "existing_principal",
    });
    expect(repository.resolveOrCreateAccount).not.toHaveBeenCalled();
  });

  it("creates a non-CRM account with the canonical Customers-only HMAC domain", async () => {
    const repository = createRepository();
    const resolver = createAccountIdentityResolver({
      lookupSecret: secret,
      repository,
      resolveCustomerClaim: async () => ({
        accountId: null,
        assurance: null,
        status: "not_claimable",
      }),
    });

    await expect(resolver.resolveOrCreate(identity)).resolves.toEqual({
      accountId: "account-created",
      outcome: "created",
    });
    expect(repository.resolveOrCreateAccount).toHaveBeenCalledWith({
      emailDigest: hmac("email\u0000person@example.test"),
      firebaseUid: identity.firebaseUid,
      idempotencyKey: identity.idempotencyKey,
      phoneDigest: hmac("phone\u0000+84901234567"),
      policyVersions: {
        identity: "identity-v2",
        lookup: "hmac-sha256-nul-v1",
        phone: "e164-v1",
      },
    });
  });

  it("fails closed for a conflicting Customers-only claim", async () => {
    const repository = createRepository();
    const resolver = createAccountIdentityResolver({
      lookupSecret: secret,
      repository,
      resolveCustomerClaim: async () => ({
        accountId: null,
        assurance: null,
        status: "conflict",
      }),
    });

    await expect(resolver.resolveOrCreate(identity)).rejects.toMatchObject({
      code: "crm_conflict",
    });
    expect(repository.resolveOrCreateAccount).not.toHaveBeenCalled();
  });

  it("fails closed when the Customers-only adapter is unavailable", async () => {
    const repository = createRepository();
    const resolver = createAccountIdentityResolver({
      lookupSecret: secret,
      repository,
      resolveCustomerClaim: async () => {
        throw new Error("request_failed");
      },
    });

    await expect(resolver.resolveOrCreate(identity)).rejects.toMatchObject({
      code: "crm_unavailable",
    });
    expect(repository.resolveOrCreateAccount).not.toHaveBeenCalled();
  });

  it("allows a phone-only verified factor for checkout without promoting email", async () => {
    const repository = createRepository();
    const resolveCustomerClaim = vi.fn(async () => ({
      accountId: null,
      assurance: null,
      status: "not_claimable" as const,
    }));
    const resolver = createAccountIdentityResolver({
      lookupSecret: secret,
      repository,
      resolveCustomerClaim,
    });

    await expect(resolver.resolveOrCreate({
      ...identity,
      email: null,
      intent: "checkout",
    })).resolves.toEqual({
      accountId: "account-created",
      outcome: "created",
    });
    expect(resolveCustomerClaim).toHaveBeenCalledWith({
      emailVerified: false,
      firebaseUid: identity.firebaseUid,
      phoneVerified: true,
      verifiedPhoneE164: identity.phoneE164,
    });
    expect(repository.resolveOrCreateAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        emailDigest: null,
        phoneDigest: hmac("phone\u0000+84901234567"),
      }),
    );
  });

  it("rejects checkout when no verified factor exists", async () => {
    const repository = createRepository();
    const resolveCustomerClaim = vi.fn();
    const resolver = createAccountIdentityResolver({
      lookupSecret: secret,
      repository,
      resolveCustomerClaim,
    });

    await expect(resolver.resolveOrCreate({
      ...identity,
      email: null,
      phoneE164: null,
    })).rejects.toMatchObject({
      code: "identity_incomplete",
    } satisfies Partial<AccountIdentityResolutionError>);
    expect(resolveCustomerClaim).not.toHaveBeenCalled();
  });

  it("allows an email-only verified factor for checkout", async () => {
    const repository = createRepository();
    const resolveCustomerClaim = vi.fn(async () => ({
      accountId: null,
      assurance: null,
      status: "not_claimable" as const,
    }));
    const resolver = createAccountIdentityResolver({
      lookupSecret: secret,
      repository,
      resolveCustomerClaim,
    });

    await resolver.resolveOrCreate({
      ...identity,
      intent: "checkout",
      phoneE164: null,
    });

    expect(resolveCustomerClaim).toHaveBeenCalledWith({
      emailVerified: true,
      firebaseUid: identity.firebaseUid,
      phoneVerified: false,
      verifiedEmail: identity.email,
    });
    expect(repository.resolveOrCreateAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        emailDigest: hmac("email\u0000person@example.test"),
        phoneDigest: null,
      }),
    );
  });
});

function hmac(value: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}
