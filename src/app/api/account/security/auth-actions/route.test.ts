import { beforeEach, describe, expect, it, vi } from "vitest";
import { sameOriginRequest } from "@/test/same-origin-request";

const ports = vi.hoisted(() => ({ getAuthenticatedAccount: vi.fn(), requestAuthAction: vi.fn() }));
vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountSecurityPort: () => ({ requestAuthAction: ports.requestAuthAction }),
}));

import { POST } from "./route";

const account = { accountId: "account_01", firebaseUid: "firebase_01", identities: [], locale: "vi" };

describe("/api/account/security/auth-actions", () => {
  beforeEach(() => { ports.getAuthenticatedAccount.mockReset(); ports.requestAuthAction.mockReset(); });

  it("rejects an anonymous auth action with private response headers", async () => {
    // Given: no authenticated Account identity.
    ports.getAuthenticatedAccount.mockResolvedValue(null);

    // When: an auth action is requested.
    const response = await POST(sameOriginRequest("https://app.test/api/account/security/auth-actions", { body: JSON.stringify({ action: "unlink_email" }), headers: { "content-type": "application/json" }, method: "POST" }));

    // Then: it fails closed without reaching the security port.
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(ports.requestAuthAction).not.toHaveBeenCalled();
  });

  it("accepts only declared placeholder actions", async () => {
    // Given: an authenticated Account identity.
    ports.getAuthenticatedAccount.mockResolvedValue(account);

    // When: the browser submits an undeclared auth action.
    const response = await POST(sameOriginRequest("https://app.test/api/account/security/auth-actions", { body: JSON.stringify({ action: "link_passkey" }), headers: { "content-type": "application/json" }, method: "POST" }));

    // Then: strict parsing rejects it before the port receives input.
    expect(response.status).toBe(422);
    expect(ports.requestAuthAction).not.toHaveBeenCalled();
  });

  it("hides a rejected security action port behind a generic private failure", async () => {
    // Given: an authenticated account whose security action port rejects with sensitive details.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.requestAuthAction.mockRejectedValue(new Error("identity action failure"));

    // When: a declared auth action is requested.
    const response = await POST(sameOriginRequest("https://app.test/api/account/security/auth-actions", { body: JSON.stringify({ action: "unlink_email" }), headers: { "content-type": "application/json" }, method: "POST" }));

    // Then: the rejection remains private and generic.
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
