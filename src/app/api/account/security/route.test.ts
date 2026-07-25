import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({ getAuthenticatedAccount: vi.fn(), getSecurity: vi.fn() }));
vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountSecurityPort: () => ({ getSecurity: ports.getSecurity }),
}));

import { GET } from "./route";

const account = { accountId: "account_01", firebaseUid: "firebase_01", identities: [], locale: "vi" } as const;

describe("/api/account/security", () => {
  beforeEach(() => { ports.getAuthenticatedAccount.mockReset(); ports.getSecurity.mockReset(); });

  it("rejects anonymous reads with private no-store headers", async () => {
    // Given: no authenticated Account identity.
    ports.getAuthenticatedAccount.mockResolvedValue(null);

    // When: security data is requested.
    const response = await GET();

    // Then: no account port is consulted and response data stays private.
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(ports.getSecurity).not.toHaveBeenCalled();
  });

  it("derives the account only from the auth port", async () => {
    // Given: an authenticated account and a masked security presentation.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.getSecurity.mockResolvedValue({ identities: [{ provider: "email", maskedIdentifier: "m***@example.com", verified: true }], sessionCount: 1 });

    // When: security data is requested.
    const response = await GET();

    // Then: no browser account input can influence the port call.
    expect(response.status).toBe(200);
    expect(ports.getSecurity).toHaveBeenCalledWith(account);
    await expect(response.json()).resolves.toEqual({ identities: [{ provider: "email", maskedIdentifier: "m***@example.com", verified: true }], sessionCount: 1 });
  });
});
