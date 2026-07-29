import { beforeEach, describe, expect, it, vi } from "vitest";
import { sameOriginRequest } from "@/test/same-origin-request";

const ports = vi.hoisted(() => ({
  getAuthenticatedAccount: vi.fn(),
  mergeGuestItems: vi.fn(),
}));

vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountWishlistPort: () => ({ mergeGuestItems: ports.mergeGuestItems }),
}));

import { POST } from "./route";

const account = {
  accountId: "account_01",
  firebaseUid: "firebase_01",
  locale: "vi",
  identities: [],
} as const;

const items = [{ availability: "available", href: "/vi/products/variant-01", title: "Sản phẩm variant-01", variantId: "variant-01" }] as const;

describe("/api/account/merge-guest-state", () => {
  beforeEach(() => {
    ports.getAuthenticatedAccount.mockReset();
    ports.mergeGuestItems.mockReset();
  });

  it("rejects anonymous guest merges with private response headers", async () => {
    // Given: no authenticated Account identity.
    ports.getAuthenticatedAccount.mockResolvedValue(null);

    // When: a guest merge is requested.
    const response = await POST(sameOriginRequest("https://app.test/api/account/merge-guest-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: "merge-01", variantIds: ["variant-01"] }),
    }));

    // Then: no merge reaches the Account-local port.
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(ports.mergeGuestItems).not.toHaveBeenCalled();
  });

  it("validates bounded canonical ids and never accepts a browser account id", async () => {
    // Given: an authenticated Account identity.
    ports.getAuthenticatedAccount.mockResolvedValue(account);

    // When: the browser submits an account id alongside guest state.
    const response = await POST(sameOriginRequest("https://app.test/api/account/merge-guest-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId: "account_other", idempotencyKey: "merge-01", variantIds: ["variant-01"] }),
    }));

    // Then: the strict API boundary rejects the entire payload.
    expect(response.status).toBe(422);
    expect(ports.mergeGuestItems).not.toHaveBeenCalled();
  });

  it("rejects a guest merge that exceeds the variant id limit", async () => {
    // Given: an authenticated Account identity and an oversized guest payload.
    ports.getAuthenticatedAccount.mockResolvedValue(account);

    // When: more than fifty canonical variant ids are submitted.
    const response = await POST(sameOriginRequest("https://app.test/api/account/merge-guest-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: "merge-01", variantIds: Array.from({ length: 51 }, (_, index) => `variant-${index}`) }),
    }));

    // Then: boundary validation rejects it before account data changes.
    expect(response.status).toBe(422);
    expect(ports.mergeGuestItems).not.toHaveBeenCalled();
  });

  it("hides a rejected guest-state merge port behind a generic private failure", async () => {
    // Given: an authenticated account whose guest-state port rejects with sensitive details.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.mergeGuestItems.mockRejectedValue(new Error("guest state storage failure"));

    // When: valid guest variant ids are submitted.
    const response = await POST(sameOriginRequest("https://app.test/api/account/merge-guest-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: "merge-01", variantIds: ["variant-01"] }),
    }));

    // Then: the rejection remains private and generic.
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });

  it("returns the port's canonical merged set", async () => {
    // Given: a valid authenticated merge and a canonical server response.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.mergeGuestItems.mockResolvedValue(items);

    // When: guest variant ids are submitted.
    const response = await POST(sameOriginRequest("https://app.test/api/account/merge-guest-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: "merge-01", variantIds: ["variant-01"] }),
    }));

    // Then: account scope and canonical ids are the only port inputs.
    expect(response.status).toBe(200);
    expect(ports.mergeGuestItems).toHaveBeenCalledWith(account, { idempotencyKey: "merge-01", variantIds: ["variant-01"] });
    await expect(response.json()).resolves.toEqual({ items });
  });
});
