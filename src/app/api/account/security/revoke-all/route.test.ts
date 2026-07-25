import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({ getAuthenticatedAccount: vi.fn(), revokeAllSessions: vi.fn() }));
vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountSecurityPort: () => ({ revokeAllSessions: ports.revokeAllSessions }),
}));

import { POST } from "./route";

const account = { accountId: "account_01", firebaseUid: "firebase_01", identities: [], locale: "vi" };

describe("/api/account/security/revoke-all", () => {
  beforeEach(() => { ports.getAuthenticatedAccount.mockReset(); ports.revokeAllSessions.mockReset(); });

  it("reports recent authentication before revoking all sessions", async () => {
    // Given: an authenticated account under the default sensitive-action policy.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.revokeAllSessions.mockResolvedValue({ kind: "recent_authentication_required" });

    // When: all sessions are revoked.
    const response = await POST(new Request("https://app.test/api/account/security/revoke-all", { method: "POST" }));

    // Then: the API preserves the protected action result and private headers.
    expect(response.status).toBe(409);
    expect(response.headers.get("vary")).toBe("Cookie");
    await expect(response.json()).resolves.toEqual({ kind: "recent_authentication_required" });
  });

  it("hides a rejected revoke-all port behind a generic private failure", async () => {
    // Given: an authenticated account whose session port rejects with sensitive details.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.revokeAllSessions.mockRejectedValue(new Error("session revocation failure"));

    // When: all sessions are revoked.
    const response = await POST(new Request("https://app.test/api/account/security/revoke-all", { method: "POST" }));

    // Then: the rejection remains private and generic.
    expect(response.status).toBe(500);
    expect(response.headers.get("vary")).toBe("Cookie");
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
