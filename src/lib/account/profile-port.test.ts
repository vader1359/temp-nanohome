import { describe, expect, it } from "vitest";

import { createFakeAccountProfilePort } from "./profile-port";

const account = {
  accountId: "account_01",
  firebaseUid: "firebase_01",
  locale: "vi",
  identities: [
    { provider: "phone", identifier: "+84901234567", verified: true },
    { provider: "kakao", identifier: "customer@example.test", verified: false },
  ],
} as const;

describe("createFakeAccountProfilePort", () => {
  it("presents verified contacts separately from provider metadata", async () => {
    // Given: a phone-only account with unverified Kakao metadata.
    const port = createFakeAccountProfilePort();

    // When: the profile is resolved.
    const profile = await port.getProfile(account);

    // Then: only the verified phone is presented as a primary contact.
    expect(profile.primaryEmail).toBeNull();
    expect(profile.primaryPhone).toBe("+84901234567");
    expect(profile.providerMetadata).toEqual([
      { provider: "kakao", identifier: "customer@example.test" },
    ]);
  });

  it("persists only the normalized changed fields for the account", async () => {
    // Given: an account profile and a normalized profile patch.
    const port = createFakeAccountProfilePort();

    // When: the Account lane patches its editable name.
    const updated = await port.patchProfile(account, { fullName: "An Nguyễn" });

    // Then: the changed field persists while unrelated fields are retained.
    expect(updated.fullName).toBe("An Nguyễn");
    expect(updated.locale).toBe("vi");
    await expect(port.getProfile(account)).resolves.toEqual(updated);
  });
});
