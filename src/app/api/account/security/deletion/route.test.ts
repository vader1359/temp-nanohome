import { beforeEach, describe, expect, it, vi } from "vitest";
import { sameOriginRequest } from "@/test/same-origin-request";

const ports = vi.hoisted(() => ({ beginDeletion: vi.fn(), confirmDeletion: vi.fn(), getAuthenticatedAccount: vi.fn() }));
vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountSecurityPort: () => ({ beginDeletion: ports.beginDeletion, confirmDeletion: ports.confirmDeletion }),
}));

import { POST } from "./route";

const account = { accountId: "account_01", firebaseUid: "firebase_01", identities: [], locale: "vi" };

describe("/api/account/security/deletion", () => {
  beforeEach(() => { ports.beginDeletion.mockReset(); ports.confirmDeletion.mockReset(); ports.getAuthenticatedAccount.mockReset(); });

  it("begins deletion only for the authenticated account", async () => {
    // Given: an authenticated account with a protected deletion result.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.beginDeletion.mockResolvedValue({ kind: "recent_authentication_required" });

    // When: the browser begins deletion.
    const response = await POST(sameOriginRequest("https://app.test/api/account/security/deletion", { body: JSON.stringify({ action: "begin" }), headers: { "content-type": "application/json" }, method: "POST" }));

    // Then: the flow requires recent authentication and no client identity is accepted.
    expect(response.status).toBe(409);
    expect(ports.beginDeletion).toHaveBeenCalledWith(account);
  });

  it("requires an exact DELETE confirmation before calling the port", async () => {
    // Given: an authenticated account.
    ports.getAuthenticatedAccount.mockResolvedValue(account);

    // When: the browser supplies a lowercase confirmation.
    const response = await POST(sameOriginRequest("https://app.test/api/account/security/deletion", { body: JSON.stringify({ confirmation: "delete" }), headers: { "content-type": "application/json" }, method: "POST" }));

    // Then: strict parsing rejects it before deletion confirmation reaches the port.
    expect(response.status).toBe(422);
    expect(ports.confirmDeletion).not.toHaveBeenCalled();
  });

  it("hides a rejected deletion port behind a generic private failure", async () => {
    // Given: an authenticated account whose deletion port rejects with sensitive details.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.beginDeletion.mockRejectedValue(new Error("deletion workflow failure"));

    // When: deletion begins.
    const response = await POST(sameOriginRequest("https://app.test/api/account/security/deletion", { body: JSON.stringify({ action: "begin" }), headers: { "content-type": "application/json" }, method: "POST" }));

    // Then: the rejection remains private and generic.
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
