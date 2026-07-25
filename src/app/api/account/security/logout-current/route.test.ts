import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({ getAuthenticatedAccount: vi.fn(), logoutCurrentSession: vi.fn() }));
vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountSecurityPort: () => ({ logoutCurrentSession: ports.logoutCurrentSession }),
}));

import { POST } from "./route";

const account = { accountId: "account_01", firebaseUid: "firebase_01", identities: [], locale: "vi" };
const result = { kind: "completed", security: { identities: [], sessionCount: 1 } };

describe("/api/account/security/logout-current", () => {
  beforeEach(() => { ports.getAuthenticatedAccount.mockReset(); ports.logoutCurrentSession.mockReset(); });

  it("logs out only the authenticated account's current session", async () => {
    // Given: an authenticated account and canonical logout result.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.logoutCurrentSession.mockResolvedValue(result);

    // When: the bodyless logout action is requested.
    const response = await POST(new Request("https://app.test/api/account/security/logout-current", { method: "POST" }));

    // Then: the account-scoped port result is private and canonical.
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(ports.logoutCurrentSession).toHaveBeenCalledWith(account);
    await expect(response.json()).resolves.toEqual(result);
  });
});
