import { describe, expect, it, vi } from "vitest";

import { createAccountProfilePort, createFakeAccountProfilePort } from "./profile-port";

const account = {
  accountId: "account_01",
  firebaseUid: "firebase_01",
  locale: "vi",
  identities: [
    { provider: "phone", identifier: "+84901234567", verified: true },
    { provider: "google", identifier: "customer@example.test", verified: false },
  ],
} as const;

describe("createFakeAccountProfilePort", () => {
  it("presents verified contacts separately from provider metadata", async () => {
    // Given: a phone-only account with unverified Google metadata.
    const port = createFakeAccountProfilePort();

    // When: the profile is resolved.
    const profile = await port.getProfile(account);

    // Then: only the verified phone is presented as a primary contact.
    expect(profile.primaryEmail).toBeNull();
    expect(profile.primaryPhone).toBe("+84901234567");
    expect(profile.providerMetadata).toEqual([
      { provider: "google", identifier: "customer@example.test" },
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

describe("createAccountProfilePort", () => {
  it("scopes durable profile reads to the server-resolved account and overlays verified contacts", async () => {
    const getProfile = vi.fn(async () => ({
      fullName: "An Nguyễn",
      dateOfBirth: null,
      nationality: "Việt Nam",
      formOfAddress: null,
      locale: "vi",
    }));
    const port = createAccountProfilePort({
      getProfile,
      patchProfile: vi.fn(),
    });

    await expect(port.getProfile(account)).resolves.toMatchObject({
      fullName: "An Nguyễn",
      primaryPhone: "+84901234567",
    });
    expect(getProfile).toHaveBeenCalledWith("account_01");
  });

  it("uses the server canonical contact kinds when presenting verified contacts", async () => {
    const port = createAccountProfilePort({
      getProfile: vi.fn(async () => null),
      getVerifiedContactKinds: vi.fn(async () => ["email"] as const),
      patchProfile: vi.fn(),
    });
    const accountWithEmail = {
      ...account,
      identities: [
        { identifier: "customer@example.test", provider: "email", verified: true },
        { identifier: "+84901234567", provider: "phone", verified: true },
      ],
    } as const;

    await expect(port.getProfile(accountWithEmail)).resolves.toMatchObject({
      primaryEmail: "customer@example.test",
      primaryPhone: null,
    });
  });
});
