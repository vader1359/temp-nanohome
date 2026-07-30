import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createFirebaseAccountAuthPort } from "./auth-port";

describe("createFirebaseAccountAuthPort", () => {
  it("resolves ownership only from the verified Firebase UID", async () => {
    const resolveAccountId = vi.fn(async () => "account-owned");
    const port = createFirebaseAccountAuthPort({
      getClaims: async () => ({
        uid: "firebase-owned",
        email: "owner@example.test",
        email_verified: true,
        phone_number: "+84901234567",
        firebase: {
          identities: { "google.com": ["google-subject"] },
          sign_in_provider: "google.com",
        },
      }),
      getLocale: async () => "vi",
      resolveAccountId,
    });

    await expect(port.getAuthenticatedAccount()).resolves.toEqual({
      accountId: "account-owned",
      firebaseUid: "firebase-owned",
      locale: "vi",
      identities: [
        { provider: "email", identifier: "owner@example.test", verified: true },
        { provider: "phone", identifier: "+84901234567", verified: true },
        { provider: "google", identifier: "owner@example.test", verified: true },
      ],
    });
    expect(resolveAccountId).toHaveBeenCalledWith("firebase-owned");
  });

  it("fails closed when the Firebase principal has no active account mapping", async () => {
    const port = createFirebaseAccountAuthPort({
      getClaims: async () => ({ uid: "firebase-unmapped" }),
      getLocale: async () => "vi",
      resolveAccountId: async () => null,
    });

    await expect(port.getAuthenticatedAccount()).resolves.toBeNull();
  });

  it("does not treat unverified email as an authorization proof", async () => {
    const port = createFirebaseAccountAuthPort({
      getClaims: async () => ({
        uid: "firebase-owned",
        email: "unverified@example.test",
        email_verified: false,
        firebase: { sign_in_provider: "password" },
      }),
      getLocale: async () => "en",
      resolveAccountId: async () => "account-owned",
    });

    await expect(port.getAuthenticatedAccount()).resolves.toMatchObject({
      identities: [
        { provider: "email", identifier: "unverified@example.test", verified: false },
      ],
    });
  });

  it("presents only contact kinds confirmed by the server canonical contact rows", async () => {
    const port = createFirebaseAccountAuthPort({
      getClaims: async () => ({
        uid: "firebase-owned",
        email: "owner@example.test",
        email_verified: true,
        phone_number: "+84901234567",
        firebase: { sign_in_provider: "password" },
      }),
      getLocale: async () => "vi",
      resolveAccountId: async () => "account-owned",
      resolveVerifiedContactKinds: async () => ["email"],
    });

    await expect(port.getAuthenticatedAccount()).resolves.toMatchObject({
      identities: [{ identifier: "owner@example.test", provider: "email", verified: true }],
    });
  });
});
