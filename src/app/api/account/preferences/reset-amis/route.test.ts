import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({ getAuthenticatedAccount: vi.fn(), resetAmisHistory: vi.fn() }));
vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountPreferencesPort: () => ({ resetAmisHistory: ports.resetAmisHistory }),
}));

import { POST } from "./route";

const account = { accountId: "account_01", firebaseUid: "firebase_01", identities: [], locale: "vi" };

describe("/api/account/preferences/reset-amis", () => {
  beforeEach(() => { ports.getAuthenticatedAccount.mockReset(); ports.resetAmisHistory.mockReset(); });

  it("reports reauthentication without exposing AMIS data", async () => {
    // Given: an authenticated account under the default fake policy.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.resetAmisHistory.mockResolvedValue({ kind: "recent_authentication_required" });

    // When: AMIS history is reset.
    const response = await POST(new Request("https://app.test/api/account/preferences/reset-amis", { method: "POST" }));

    // Then: the response is private and asks for recent authentication.
    expect(response.status).toBe(409);
    expect(response.headers.get("vary")).toBe("Cookie");
    await expect(response.json()).resolves.toEqual({ kind: "recent_authentication_required" });
  });

  it("rejects a non-JSON body before resetting AMIS history", async () => {
    // Given: an authenticated account.
    ports.getAuthenticatedAccount.mockResolvedValue(account);

    // When: a text body is submitted to the bodyless action.
    const response = await POST(new Request("https://app.test/api/account/preferences/reset-amis", {
      body: "unexpected",
      headers: { "content-type": "text/plain" },
      method: "POST",
    }));

    // Then: unsupported media is rejected without calling the port.
    expect(response.status).toBe(415);
    expect(ports.resetAmisHistory).not.toHaveBeenCalled();
  });
});
