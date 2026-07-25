import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  getAuthenticatedAccount: vi.fn(),
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
}));

vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountPreferencesPort: () => ({
    getPreferences: ports.getPreferences,
    updatePreferences: ports.updatePreferences,
  }),
}));

import { GET, PATCH } from "./route";

const account = { accountId: "account_01", firebaseUid: "firebase_01", identities: [], locale: "vi" };
const preferences = {
  amisHistory: { available: false, enabled: false },
  browsingHistoryEnabled: true,
  productPersonalizationEnabled: true,
  recommendationDataState: "available",
};

describe("/api/account/preferences", () => {
  beforeEach(() => {
    ports.getAuthenticatedAccount.mockReset();
    ports.getPreferences.mockReset();
    ports.updatePreferences.mockReset();
  });

  it("returns a private no-store response when anonymous", async () => {
    // Given: no authenticated Account identity.
    ports.getAuthenticatedAccount.mockResolvedValue(null);

    // When: preferences are requested.
    const response = await GET();

    // Then: it fails closed with private headers.
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("vary")).toBe("Cookie");
  });

  it("hides a rejected preferences port behind a generic private failure", async () => {
    // Given: an authenticated account whose preferences port rejects with sensitive details.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.getPreferences.mockRejectedValue(new Error("preferences storage failure"));

    // When: preferences are requested.
    const response = await GET();

    // Then: the rejection remains private and generic.
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });

  it("updates only a safe preference toggle", async () => {
    // Given: an authenticated account and canonical fake preferences.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.updatePreferences.mockResolvedValue(preferences);

    // When: the browser disables browsing history.
    const response = await PATCH(new Request("https://app.test/api/account/preferences", {
      body: JSON.stringify({ browsingHistoryEnabled: false }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    }));

    // Then: only the canonical safe patch reaches the account port.
    expect(response.status).toBe(200);
    expect(ports.updatePreferences).toHaveBeenCalledWith(account, { browsingHistoryEnabled: false });
    await expect(response.json()).resolves.toEqual(preferences);
  });

  it("rejects a non-JSON patch before it reaches the port", async () => {
    // Given: an authenticated account.
    ports.getAuthenticatedAccount.mockResolvedValue(account);

    // When: the browser omits the JSON content type.
    const response = await PATCH(new Request("https://app.test/api/account/preferences", { method: "PATCH" }));

    // Then: the API reports unsupported media without mutating preferences.
    expect(response.status).toBe(415);
    expect(ports.updatePreferences).not.toHaveBeenCalled();
  });

  it("rejects malformed and unsafe preference patches", async () => {
    // Given: an authenticated account.
    ports.getAuthenticatedAccount.mockResolvedValue(account);

    // When: malformed JSON is submitted.
    const malformed = await PATCH(new Request("https://app.test/api/account/preferences", {
      body: "{",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    }));

    // Then: malformed JSON receives a boundary error.
    expect(malformed.status).toBe(400);

    // When: the patch includes forbidden AMIS data.
    const unsafe = await PATCH(new Request("https://app.test/api/account/preferences", {
      body: JSON.stringify({ amisId: "forged", browsingHistoryEnabled: false }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    }));

    // Then: strict parsing prevents the mutation.
    expect(unsafe.status).toBe(422);
    expect(ports.updatePreferences).not.toHaveBeenCalled();
  });
});
