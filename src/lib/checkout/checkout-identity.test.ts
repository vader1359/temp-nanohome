import { describe, expect, it } from "vitest";

import type { AuthenticatedAccount } from "@/lib/account/auth-port";

import {
  resolveCheckoutIdentity,
  resolveCheckoutOrderContact,
} from "./checkout-identity";

const accountBase = {
  accountId: "account-owned",
  firebaseUid: "firebase-owned",
  locale: "vi",
} as const;

function account(
  identities: AuthenticatedAccount["identities"],
): AuthenticatedAccount {
  return { ...accountBase, identities };
}

describe("checkout identity and order-contact contract", () => {
  it.each([
    [
      [{ identifier: "Customer@Example.test", provider: "email", verified: true }],
      {
        accountId: "account-owned",
        firebaseUid: "firebase-owned",
        verifiedEmail: "customer@example.test",
        verifiedPhoneE164: null,
      },
    ],
    [
      [{ identifier: "+84 901 234 567", provider: "phone", verified: true }],
      {
        accountId: "account-owned",
        firebaseUid: "firebase-owned",
        verifiedEmail: null,
        verifiedPhoneE164: "+84901234567",
      },
    ],
  ] as const)("allows checkout with one verified factor %#", (identities, expected) => {
    expect(resolveCheckoutIdentity(account(identities))).toEqual({
      identity: expected,
      kind: "ready",
    });
  });

  it("blocks zero verified factors", () => {
    expect(resolveCheckoutIdentity(account([
      { identifier: "unverified@example.test", provider: "email", verified: false },
    ]))).toEqual({
      kind: "identity_required",
      missing: ["email", "phone"],
    });
  });

  it("normalizes both required order contacts without promoting the unverified factor", () => {
    const identity = resolveCheckoutIdentity(account([
      { identifier: "Customer@Example.test", provider: "email", verified: true },
    ]));
    expect(identity.kind).toBe("ready");
    if (identity.kind !== "ready") return;

    expect(resolveCheckoutOrderContact(identity.identity, {
      email: " CUSTOMER@EXAMPLE.TEST ",
      phone: "090 123 4567",
    })).toEqual({
      contact: {
        email: "customer@example.test",
        phoneE164: "+84901234567",
      },
      kind: "ready",
    });
    expect(identity.identity.verifiedPhoneE164).toBeNull();
  });

  it("rejects invalid contacts and contradictions of a verified factor", () => {
    const emailIdentity = resolveCheckoutIdentity(account([
      { identifier: "customer@example.test", provider: "email", verified: true },
    ]));
    const phoneIdentity = resolveCheckoutIdentity(account([
      { identifier: "+84901234567", provider: "phone", verified: true },
    ]));
    if (emailIdentity.kind !== "ready" || phoneIdentity.kind !== "ready") return;

    expect(resolveCheckoutOrderContact(emailIdentity.identity, {
      email: "attacker@example.test",
      phone: "0901234567",
    })).toEqual({ kind: "verified_contact_mismatch" });
    expect(resolveCheckoutOrderContact(phoneIdentity.identity, {
      email: "buyer@example.test",
      phone: "0900000000",
    })).toEqual({ kind: "verified_contact_mismatch" });
    expect(resolveCheckoutOrderContact(emailIdentity.identity, {
      email: "customer@example.test",
      phone: "not-a-phone",
    })).toEqual({ kind: "invalid_contact" });
  });
});
