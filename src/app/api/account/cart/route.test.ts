import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({ addItem: vi.fn(), getAuthenticatedAccount: vi.fn(), getCart: vi.fn(), removeItem: vi.fn(), updateItem: vi.fn() }));
vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountCartPort: () => ({ addItem: ports.addItem, getCart: ports.getCart, removeItem: ports.removeItem, updateItem: ports.updateItem }),
}));
import { DELETE, GET, PATCH, POST } from "./route";

const account = { accountId: "account_01", firebaseUid: "firebase_01", locale: "vi", identities: [] } as const;
const cart = { items: [], total: { amount: 0, currency: "VND" }, version: 1 } as const;

describe("/api/account/cart", () => {
  beforeEach(() => { ports.addItem.mockReset(); ports.getAuthenticatedAccount.mockReset(); ports.getCart.mockReset(); ports.removeItem.mockReset(); ports.updateItem.mockReset(); });
  it("rejects anonymous cart reads with private no-store headers", async () => {
    // Given: no authenticated account.
    ports.getAuthenticatedAccount.mockResolvedValue(null);
    // When: the cart is read.
    const response = await GET();
    // Then: no cart port is reached.
    expect(response.status).toBe(401); expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0"); expect(response.headers.get("vary")).toBe("Cookie"); expect(ports.getCart).not.toHaveBeenCalled();
  });
  it("passes only strict cart additions to the account port", async () => {
    // Given: an authenticated account.
    ports.getAuthenticatedAccount.mockResolvedValue(account); ports.addItem.mockResolvedValue({ cart, status: "updated" });
    // When: browser presentation data accompanies an add request.
    const response = await POST(new Request("https://app.test/api/account/cart", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: 1, price: 1, quantity: 1, variantId: "chair-oak" }) }));
    // Then: strict validation rejects it before mutation.
    expect(response.status).toBe(422); expect(ports.addItem).not.toHaveBeenCalled();
  });
  it("returns a current cart on a version conflict", async () => {
    // Given: an authenticated account and a stale mutation result.
    ports.getAuthenticatedAccount.mockResolvedValue(account); ports.updateItem.mockResolvedValue({ cart, status: "version_conflict" });
    // When: the browser updates a quantity.
    const response = await PATCH(new Request("https://app.test/api/account/cart", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: 0, quantity: 2, variantId: "chair-oak" }) }));
    // Then: it returns the canonical conflict payload without retrying.
    expect(response.status).toBe(409); await expect(response.json()).resolves.toEqual({ cart, error: "version_conflict" });
  });
  it("removes using only a variant id and expected version", async () => {
    // Given: an authenticated account and updated cart.
    ports.getAuthenticatedAccount.mockResolvedValue(account); ports.removeItem.mockResolvedValue({ cart, status: "updated" });
    // When: a canonical remove request is submitted.
    const response = await DELETE(new Request("https://app.test/api/account/cart", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: 1, variantId: "chair-oak" }) }));
    // Then: only selection and version cross the browser boundary.
    expect(response.status).toBe(200); expect(ports.removeItem).toHaveBeenCalledWith(account, { expectedVersion: 1, variantId: "chair-oak" });
  });
});
