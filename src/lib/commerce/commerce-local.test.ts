import { describe, expect, it } from "vitest";

import { createCommerceLocalServices, type CommerceCatalog } from "./commerce-local";

const eligibility = { variant_id: "variant-1", product_id: "product-1", brand_id: null, sku: "SKU-SERVER", variant_slug: "variant-1", variant_name: "Variant", localized_name: "Variant", product_slug: "product-1", product_name: "Product", localized_product_name: "Product", brand_slug: null, brand_name: null, image_url: null, price: 125000, stock: 1, price_mode: "fixed", has_fresh_stock: true, has_supported_media: true, catalog_approved_validated: true, hidden_brand_sku: false, reason_codes: [], storefront: true, recommendation: true, visual_match: true, cart: true, payment: true } as const;
const catalog: CommerceCatalog = {
  async findVariant(variantId) {
    return variantId === "variant-1"
      ? { variantId, sku: "SKU-SERVER", unitAmount: 125000, currency: "VND", warehouseId: "warehouse-hcm", eligibility }
      : null;
  },
};

describe("commerce-local server-owned services", () => {
  it.each([
    ["", "warehouse-hcm", "VND", 125000],
    ["SKU-SERVER", "", "VND", 125000],
    ["SKU-SERVER", "warehouse-hcm", "USD", 125000],
    ["SKU-SERVER", "warehouse-hcm", "VND", -1],
  ] as const)("rejects malformed server variant fields (%s, %s, %s, %s)", async (sku, warehouseId, currency, unitAmount) => {
    const services = createCommerceLocalServices({
        catalog: { findVariant: async () => ({ variantId: "variant-1", sku, warehouseId, currency, unitAmount, eligibility }) },
    });

    const result = await services.cart.replace({ owner: { kind: "user", id: "user-1" }, selections: [{ variantId: "variant-1", quantity: 1 }] });

    expect(result).toEqual({ kind: "variant_not_found" });
  });

  it("keeps idempotency hashes stable when contact object keys arrive in a different order", async () => {
    const services = createCommerceLocalServices({ catalog });
    const first = await services.checkout.create({
      owner: { kind: "user", id: "user-1" }, selections: [{ variantId: "variant-1", quantity: 1 }],
      contact: { fullName: "Test Buyer", email: "buyer@example.com", phone: "+84123456789", address: "Hanoi" }, idempotencyKey: "stable-key",
    });
    const replay = await services.checkout.create({
      owner: { kind: "user", id: "user-1" }, selections: [{ variantId: "variant-1", quantity: 1 }],
      contact: { address: "Hanoi", phone: "+84123456789", email: "buyer@example.com", fullName: "Test Buyer" }, idempotencyKey: "stable-key",
    });

    expect(replay).toEqual(first);
  });

  it("stores a cart from the server variant and ignores browser commercial values", async () => {
    const services = createCommerceLocalServices({ catalog });

    const result = await services.cart.replace({
      owner: { kind: "user", id: "user-1" },
      selections: [{ variantId: "variant-1", quantity: 2, browserSku: "FAKE", browserUnitAmount: 1 }],
    });

    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.cart.items).toEqual([{ sku: "SKU-SERVER", quantity: 2, unitAmount: 125000 }]);
      expect(result.cart.totalAmount).toBe(250000);
    }
  });

  it("creates one immutable order per owner key and payload hash", async () => {
    const services = createCommerceLocalServices({ catalog });
    const input = {
      owner: { kind: "user" as const, id: "user-1" },
      selections: [{ variantId: "variant-1", quantity: 1 }],
      contact: { fullName: "Test Buyer", email: "buyer@example.com", phone: "+84123456789", address: "Hanoi" },
      idempotencyKey: "checkout-1",
    };

    const first = await services.checkout.create(input);
    const replay = await services.checkout.create(input);

    expect(first).toEqual(replay);
    expect(first.kind).toBe("created");
    if (first.kind === "created") {
      expect(first.order.channel).toBe("WEB");
      expect(first.order.items[0]?.sku).toBe("SKU-SERVER");
      expect(first.order.items[0]?.unitAmount).toBe(125000);
    }
  });

  it("rejects an idempotency hash conflict and denies another owner's read", async () => {
    const services = createCommerceLocalServices({ catalog });
    const base = {
      owner: { kind: "user" as const, id: "user-1" },
      selections: [{ variantId: "variant-1", quantity: 1 }],
      contact: { fullName: "Test Buyer", email: "buyer@example.com", phone: "+84123456789", address: "Hanoi" },
      idempotencyKey: "checkout-1",
    };
    const created = await services.checkout.create(base);
    expect(await services.checkout.create({ ...base, contact: { ...base.contact, address: "Hue" } })).toEqual({ kind: "conflict" });

    if (created.kind === "created") {
      expect(await services.orders.get({ owner: { kind: "user", id: "user-2" }, orderId: created.order.orderId })).toEqual({ kind: "not_found" });
    }
  });

  it("rejects a cart whose variants use different currencies", async () => {
    const services = createCommerceLocalServices({
      catalog: {
        async findVariant(variantId) {
          return { variantId, sku: `SKU-${variantId}`, unitAmount: 100, currency: variantId === "vnd" ? "VND" : "USD", warehouseId: "warehouse-hcm", eligibility };
        },
      },
    });

    const result = await services.cart.replace({ owner: { kind: "user", id: "user-1" }, selections: [{ variantId: "vnd", quantity: 1 }, { variantId: "usd", quantity: 1 }] });

    expect(result).toEqual({ kind: "variant_not_found" });
  });

  it("rejects a cart whose variants use different warehouses", async () => {
    const services = createCommerceLocalServices({
      catalog: {
        async findVariant(variantId) {
          return { variantId, sku: `SKU-${variantId}`, unitAmount: 100, currency: "VND", warehouseId: variantId === "hcm" ? "warehouse-hcm" : "warehouse-hanoi", eligibility };
        },
      },
    });

    const result = await services.cart.replace({ owner: { kind: "user", id: "user-1" }, selections: [{ variantId: "hcm", quantity: 1 }, { variantId: "hanoi", quantity: 1 }] });

    expect(result).toEqual({ kind: "variant_not_found" });
  });
});
