import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({ getAuthenticatedAccount: vi.fn(), mergeGuestCart: vi.fn() }));
vi.mock("@/lib/account/account-ports.server", () => ({ getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }), getAccountCartPort: () => ({ mergeGuestCart: ports.mergeGuestCart }) }));
import { POST } from "./route";

const account = { accountId: "account_01", firebaseUid: "firebase_01", locale: "vi", identities: [] } as const;
const cart = { items: [], total: { amount: 0, currency: "VND" }, version: 1 } as const;
const variantId = "00000000-0000-4000-8000-000000000001";
const jsonHeaders = { "content-type": "application/json", origin: "https://app.test" };
describe("/api/account/cart/merge-guest", () => {
  beforeEach(() => { ports.getAuthenticatedAccount.mockReset(); ports.mergeGuestCart.mockReset(); });
  it("rejects anonymous merges without calling the port", async () => {
    // Given: no authenticated account.
    ports.getAuthenticatedAccount.mockResolvedValue(null);
    // When: a guest cart merge is requested.
    const response = await POST(new Request("https://app.test/api/account/cart/merge-guest", { headers: { origin: "https://app.test" }, method: "POST" }));
    // Then: it fails closed with private headers.
    expect(response.status).toBe(401); expect(response.headers.get("vary")).toBe("Cookie"); expect(ports.mergeGuestCart).not.toHaveBeenCalled();
  });
  it("rejects guest presentation data before an idempotent merge", async () => {
    // Given: an authenticated account.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    // When: guest input includes a forged title.
    const response = await POST(new Request("https://app.test/api/account/cart/merge-guest", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ idempotencyKey: "merge-01", items: [{ quantity: 1, title: "forged", variantId }] }) }));
    // Then: strict parsing prevents the merge.
    expect(response.status).toBe(422); expect(ports.mergeGuestCart).not.toHaveBeenCalled();
  });
  it("hides a rejected guest-cart merge port behind a generic private failure", async () => {
    // Given: an authenticated account whose merge port rejects with sensitive details.
    ports.getAuthenticatedAccount.mockResolvedValue(account); ports.mergeGuestCart.mockRejectedValue(new Error("merge storage failure"));
    // When: a valid guest cart is merged.
    const response = await POST(new Request("https://app.test/api/account/cart/merge-guest", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ idempotencyKey: "merge-01", items: [{ quantity: 1, variantId }] }) }));
    // Then: the rejection remains private and generic.
    expect(response.status).toBe(500); await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });
  it("delegates an idempotency key and selection-only guest entries", async () => {
    // Given: a valid authenticated guest selection.
    ports.getAuthenticatedAccount.mockResolvedValue(account); ports.mergeGuestCart.mockResolvedValue(cart);
    // When: it is merged.
    const response = await POST(new Request("https://app.test/api/account/cart/merge-guest", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ idempotencyKey: "merge-01", items: [{ quantity: 1, variantId }] }) }));
    // Then: the account scope remains session-derived.
    expect(response.status).toBe(200); expect(ports.mergeGuestCart).toHaveBeenCalledWith(account, { idempotencyKey: "merge-01", items: [{ quantity: 1, variantId }] }); await expect(response.json()).resolves.toEqual({ cart });
  });

  it("rejects cross-origin merge attempts before account resolution", async () => {
    const response = await POST(new Request("https://app.test/api/account/cart/merge-guest", {
      body: JSON.stringify({ idempotencyKey: "merge-01", items: [{ quantity: 1, variantId }] }),
      headers: { "content-type": "application/json", origin: "https://attacker.test" },
      method: "POST",
    }));
    expect(response.status).toBe(403);
    expect(ports.getAuthenticatedAccount).not.toHaveBeenCalled();
    expect(ports.mergeGuestCart).not.toHaveBeenCalled();
  });
});
