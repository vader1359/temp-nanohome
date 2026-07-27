import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({ disconnectAmis: vi.fn(), getAuthenticatedAccount: vi.fn() }));
vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountPreferencesPort: () => ({ disconnectAmis: ports.disconnectAmis }),
}));

import { POST } from "./route";

const account = { accountId: "account_01", firebaseUid: "firebase_01", identities: [], locale: "vi" };

describe("/api/account/preferences/disconnect-amis", () => {
  beforeEach(() => { ports.disconnectAmis.mockReset(); ports.getAuthenticatedAccount.mockReset(); });

  it("rejects anonymous AMIS disconnection with private headers", async () => {
    // Given: no authenticated account.
    ports.getAuthenticatedAccount.mockResolvedValue(null);

    // When: AMIS disconnection is requested.
    const response = await POST(new Request("https://app.test/api/account/preferences/disconnect-amis", { method: "POST" }));

    // Then: it fails closed without calling the account port.
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(ports.disconnectAmis).not.toHaveBeenCalled();
  });

  it("rejects a JSON payload before disconnecting AMIS", async () => {
    // Given: an authenticated account.
    ports.getAuthenticatedAccount.mockResolvedValue(account);

    // When: a JSON payload is submitted to the bodyless action.
    const response = await POST(new Request("https://app.test/api/account/preferences/disconnect-amis", {
      body: JSON.stringify({ confirm: true }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }));

    // Then: strict input parsing rejects the payload without calling the port.
    expect(response.status).toBe(422);
    expect(ports.disconnectAmis).not.toHaveBeenCalled();
  });

  it("hides a rejected disconnect port behind a generic private failure", async () => {
    // Given: an authenticated account whose AMIS disconnect port rejects with sensitive details.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.disconnectAmis.mockRejectedValue(new Error("AMIS credential failure"));

    // When: AMIS is disconnected.
    const response = await POST(new Request("https://app.test/api/account/preferences/disconnect-amis", { method: "POST" }));

    // Then: the rejection remains private and generic.
    expect(response.status).toBe(500);
    expect(response.headers.get("vary")).toBe("Cookie");
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
