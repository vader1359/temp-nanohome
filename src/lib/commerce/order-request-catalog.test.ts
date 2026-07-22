import { describe, expect, it, vi } from "vitest";

import { validCatalogEligibility } from "./catalog-test-support";
import { resolveOrderRequestCatalog } from "./order-request-catalog";

const malformedSelections: readonly unknown[] = [
  [],
  [{ id: "variant-1", quantity: 0 }],
  [{ id: "variant-1", quantity: 1.5 }],
  [{ id: "variant-1", quantity: 100 }],
];

describe("resolveOrderRequestCatalog", () => {
  it("uses canonical price and preserves the exact raw SKU", async () => {
    // Given: browser metadata conflicts with one eligible catalog row.
    const readEligibility = vi.fn(async () => [{
      ...validCatalogEligibility,
      variant_id: "variant-1",
      sku: " SKU.Raw-01 ",
      localized_name: "Canonical Variant",
      localized_product_name: "Canonical Product",
      brand_name: "Canonical Brand",
      price: 275000,
      stock: 3,
    }]);

    // When: the order request is resolved by variant ID and quantity.
    const result = await resolveOrderRequestCatalog(readEligibility, [{
      id: "variant-1",
      quantity: 2,
      sku: "FORGED",
      name: "Forged Name",
      price: "1 ₫",
      lineTotal: 2,
    }]);

    // Then: browser commercial fields are discarded and SKU bytes are unchanged.
    expect(readEligibility).toHaveBeenCalledWith(["variant-1"]);
    expect(result).toEqual({
      kind: "success",
      orderRequest: {
        items: [{
          variantId: "variant-1",
          sku: " SKU.Raw-01 ",
          name: "Canonical Variant",
          category: "Canonical Brand / Canonical Product",
          quantity: 2,
          unitAmount: 275000,
          lineTotal: 550000,
        }],
        totalAmount: 550000,
      },
    });
  });

  it.each([
    {
      label: "not cart eligible",
      row: { ...validCatalogEligibility, cart: false },
      selections: [{ id: "variant-1", quantity: 1 }],
    },
    {
      label: "quantity exceeds canonical stock",
      row: { ...validCatalogEligibility, stock: 1 },
      selections: [{ id: "variant-1", quantity: 2 }],
    },
    {
      label: "raw SKU is unavailable",
      row: { ...validCatalogEligibility, sku: null },
      selections: [{ id: "variant-1", quantity: 1 }],
    },
  ])("rejects a $label selection", async ({ row, selections }) => {
    // Given: a catalog row that cannot safely become an order request line.
    const readEligibility = vi.fn(async () => [row]);

    // When: the selection is resolved.
    const result = await resolveOrderRequestCatalog(readEligibility, selections);

    // Then: it fails closed without using browser fallbacks.
    expect(result).toEqual({ kind: "invalid_selection" });
  });

  it("rejects missing and duplicate variants", async () => {
    // Given: one missing catalog row and one duplicate browser selection.
    const readEligibility = vi.fn(async () => []);

    // When: both invalid shapes are resolved.
    const missing = await resolveOrderRequestCatalog(readEligibility, [{ id: "missing", quantity: 1 }]);
    const duplicate = await resolveOrderRequestCatalog(readEligibility, [
      { id: "variant-1", quantity: 1 },
      { id: "variant-1", quantity: 2 },
    ]);

    // Then: absence is an invalid selection and duplicates fail before the reader.
    expect(missing).toEqual({ kind: "invalid_selection" });
    expect(duplicate).toEqual({ kind: "invalid_payload" });
    expect(readEligibility).toHaveBeenCalledOnce();
  });

  it.each(malformedSelections)("rejects malformed selection payload %#", async (selections) => {
    // Given: a reader that must not see invalid browser input.
    const readEligibility = vi.fn(async () => [validCatalogEligibility]);

    // When: malformed selections are resolved.
    const result = await resolveOrderRequestCatalog(readEligibility, selections);

    // Then: validation stops before catalog I/O.
    expect(result).toEqual({ kind: "invalid_payload" });
    expect(readEligibility).not.toHaveBeenCalled();
  });
});
