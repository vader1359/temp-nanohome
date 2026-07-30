import { describe, expect, it } from "vitest";

import { authCompletionState, checkoutIdentityFromClaims } from "./checkout-identity";

const accountId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("checkout identity contract", () => {
  it("requires verified email and phone on the same Firebase user", () => {
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
    [{ email: "buyer@example.test", email_verified: true }, "phone_required"],
    [{ email: "buyer@example.test", email_verified: false, phone_number: "+84901234567" }, "email_required"],
    [{ email: "buyer@example.test", email_verified: true, phone_number: "+84901234567" }, "identity_complete"],
  ] as const)("classifies incomplete identity %#", (claims, expected) => {
    expect(authCompletionState(claims)).toBe(expected);
  });

  it("fails closed for a missing account, unverified contact, or mismatched claim shape", () => {
    expect(checkoutIdentityFromClaims({
      email: "buyer@example.test",
      email_verified: true,
      phone_number: "+84901234567",
      uid: "firebase-user-01",
    }, null)).toBeNull();
    expect(checkoutIdentityFromClaims({
      email: "buyer@example.test",
      email_verified: false,
      phone_number: "+84901234567",
      uid: "firebase-user-01",
    }, accountId)).toBeNull();
    expect(checkoutIdentityFromClaims({
      email: "buyer@example.test",
      email_verified: true,
      phone_number: "+84901234567",
    }, accountId)).toBeNull();
  });
});
