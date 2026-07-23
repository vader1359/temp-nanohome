import { describe, expect, it, vi } from "vitest";

const remoteFetch = vi.hoisted(() => vi.fn<typeof fetch>());

vi.mock("@/lib/remote-read-only", () => ({
  supabaseReadOnlyFetch: remoteFetch,
}));

import { getCatalogEligibility } from "./catalog";

const validRow = {
  variant_id: "variant-one", product_id: "product-one", brand_id: "brand-one", sku: "SKU-ONE",
  variant_slug: "chair", variant_name: "Chair", localized_name: "Ghế", product_slug: "chair",
  product_name: "Chair", localized_product_name: "Ghế", brand_slug: "brand", brand_name: "Brand",
  image_url: "https://res.cloudinary.com/nanohome-web/image/upload/chair", price: 1, stock: 1,
  price_mode: "fixed", has_fresh_stock: true, has_supported_media: true,
  catalog_approved_validated: true, hidden_brand_sku: false, reason_codes: [], storefront: true,
  recommendation: true, visual_match: true, cart: true, payment: true,
};

describe("getCatalogEligibility", () => {
  it("excludes malformed legacy rows without hiding valid catalog records", async () => {
    remoteFetch.mockResolvedValueOnce(new Response(JSON.stringify([
      { ...validRow, variant_id: "legacy-row", has_supported_media: null },
      validRow,
    ]), { status: 200 }));

    await expect(getCatalogEligibility()).resolves.toEqual([
      expect.objectContaining({ variant_id: "variant-one" }),
    ]);
  });
});
