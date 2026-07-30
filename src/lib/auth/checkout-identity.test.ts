import { describe, expect, it } from "vitest";

import { authCompletionState, checkoutIdentityFromClaims } from "./checkout-identity";

const accountId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("checkout identity contract", () => {
  it("preserves both verified factors when they are present", () => {
    const claims = {
      email: " Buyer@Example.test ",
      email_verified: true,
      phone_number: "+84901234567",
      uid: "firebase-user-01",
    };

    expect(authCompletionState(claims)).toBe("identity_complete");
    expect(checkoutIdentityFromClaims(claims, accountId)).toEqual({
      accountId,
      firebaseUid: "firebase-user-01",
      verifiedEmail: "buyer@example.test",
      verifiedPhoneE164: "+84901234567",
    });
  });

  it.each([
    [{}, "phone_required"],
    [{ email: "buyer@example.test", email_verified: false }, "phone_required"],
    [{ email: "buyer@example.test", email_verified: true }, "identity_complete"],
    [{ email: "buyer@example.test", email_verified: false, phone_number: "+84901234567" }, "identity_complete"],
    [{ email: "buyer@example.test", email_verified: true, phone_number: "+84901234567" }, "identity_complete"],
  ] as const)("requires at least one verified factor %#", (claims, expected) => {
    expect(authCompletionState(claims)).toBe(expected);
  });

  it("creates checkout identity from exactly one verified factor", () => {
    expect(checkoutIdentityFromClaims({
      email: "buyer@example.test",
      email_verified: true,
      uid: "firebase-email-user",
    }, accountId)).toEqual({
      accountId,
      firebaseUid: "firebase-email-user",
      verifiedEmail: "buyer@example.test",
      verifiedPhoneE164: null,
    });
    expect(checkoutIdentityFromClaims({
      email: "unverified@example.test",
      email_verified: false,
      phone_number: "+84901234567",
      uid: "firebase-phone-user",
    }, accountId)).toEqual({
      accountId,
      firebaseUid: "firebase-phone-user",
      verifiedEmail: null,
      verifiedPhoneE164: "+84901234567",
    });
  });

  it("fails closed for a missing account, zero verified factors, or missing UID", () => {
    expect(checkoutIdentityFromClaims({
      email: "buyer@example.test",
      email_verified: true,
      phone_number: "+84901234567",
      uid: "firebase-user-01",
    }, null)).toBeNull();
    expect(checkoutIdentityFromClaims({
      email: "buyer@example.test",
      email_verified: false,
      uid: "firebase-user-01",
    }, accountId)).toBeNull();
    expect(checkoutIdentityFromClaims({
      email: "buyer@example.test",
      email_verified: true,
      phone_number: "+84901234567",
    }, accountId)).toBeNull();
  });
});
