import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  getAuthenticatedAccount: vi.fn(),
  getProfile: vi.fn(),
  patchProfile: vi.fn(),
}));

vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountProfilePort: () => ({
    getProfile: ports.getProfile,
    patchProfile: ports.patchProfile,
  }),
}));

import { GET, PATCH } from "./route";

const account = {
  accountId: "account_01",
  firebaseUid: "firebase_01",
  locale: "vi",
  identities: [],
} as const;

const profile = {
  fullName: "An Nguyễn",
  dateOfBirth: null,
  nationality: null,
  formOfAddress: null,
  locale: "vi",
  primaryEmail: null,
  primaryPhone: "+84901234567",
  providerMetadata: [],
} as const;

describe("/api/account/profile", () => {
  beforeEach(() => {
    ports.getAuthenticatedAccount.mockReset();
    ports.getProfile.mockReset();
    ports.patchProfile.mockReset();
  });

  it("returns a private no-store response when anonymous", async () => {
    // Given: no authenticated Account identity.
    ports.getAuthenticatedAccount.mockResolvedValue(null);

    // When: the profile is requested.
    const response = await GET();

    // Then: it fails closed without profile access.
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("vary")).toBe("Cookie");
  });

  it("hides a rejected profile port behind a generic private failure", async () => {
    // Given: an authenticated account whose profile port rejects with sensitive details.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.getProfile.mockRejectedValue(new Error("profile database credential failure"));

    // When: the profile is requested.
    const response = await GET();

    // Then: the rejection does not expose port details.
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("vary")).toBe("Cookie");
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });

  it("normalizes a changed patch without accepting an account id", async () => {
    // Given: an authenticated account and its fake profile.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.patchProfile.mockResolvedValue(profile);

    // When: the browser submits a changed editable field.
    const response = await PATCH(new Request("https://app.test/api/account/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fullName: "  An Nguyễn  " }),
    }));

    // Then: the route sends only its normalized patch to the account-scoped port.
    expect(response.status).toBe(200);
    expect(ports.patchProfile).toHaveBeenCalledWith(account, { fullName: "An Nguyễn" });
    await expect(response.json()).resolves.toEqual(profile);
  });

  it("preserves submitted fields when a read-only contact is patched", async () => {
    // Given: an authenticated account.
    ports.getAuthenticatedAccount.mockResolvedValue(account);

    // When: the browser attempts to patch its verified phone.
    const response = await PATCH(new Request("https://app.test/api/account/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ primaryPhone: "+84909999999" }),
    }));

    // Then: it receives field feedback and the submitted value remains available.
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      fieldErrors: { primaryPhone: "Trường này chỉ có thể thay đổi trong Bảo mật." },
      submitted: { primaryPhone: "+84909999999" },
    });
    expect(ports.patchProfile).not.toHaveBeenCalled();
  });
});
