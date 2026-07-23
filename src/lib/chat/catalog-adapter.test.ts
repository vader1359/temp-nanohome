import { describe, expect, it, vi } from "vitest";

import type { CatalogEligibility } from "@/lib/catalog/eligibility";
import type { VariantProductListItem } from "@/lib/queries/products";

import {
  catalogSearchQueries,
  createPublicCatalogAdapters,
  type PublicCatalogAdapterDependencies,
} from "./catalog-adapter";

const eligibility = (
  overrides: Partial<CatalogEligibility> = {},
): CatalogEligibility => ({
  variant_id: "variant-one",
  product_id: "product-one",
  brand_id: "brand-one",
  sku: "SKU-ONE",
  variant_slug: "english-chair",
  variant_name: "English Chair",
  localized_name: "Ghế Việt",
  product_slug: "chair",
  product_name: "Chair",
  localized_product_name: "Ghế",
  brand_slug: "brand",
  brand_name: "Brand",
  image_url:
    "https://res.cloudinary.com/nanohome-web/image/upload/products/chair",
  price: 12_500_000,
  stock: 2,
  price_mode: "fixed",
  has_fresh_stock: true,
  has_supported_media: true,
  catalog_approved_validated: true,
  hidden_brand_sku: false,
  reason_codes: [],
  storefront: true,
  recommendation: true,
  visual_match: true,
  cart: true,
  payment: true,
  ...overrides,
});

const variant = (
  overrides: Partial<VariantProductListItem> = {},
): VariantProductListItem =>
  ({
    id: "variant-one",
    name: "English Chair",
    name_vi: "Ghế Việt",
    name_ko: "한국 의자",
    description: "English description",
    description_vi: "Mô tả tiếng Việt",
    description_ko: "한국어 설명",
    designer_description: "English designer biography",
    designer_description_vi: "Tiểu sử nhà thiết kế",
    designer_description_ko: "디자이너 소개",
    short_name: "Chair",
    short_name_vi: "Ghế",
    short_name_ko: "의자",
    slug: "english-chair",
    slug_vi: "ghe-viet",
    slug_ko: "hangug-yija",
    sku: "SKU-ONE",
    stock: 999,
    price: 1,
    compare_at_price: null,
    discount_percent: null,
    on_sale: false,
    in_stock: true,
    packshot_url:
      "https://res.cloudinary.com/nanohome-web/image/upload/products/chair",
    gallery_urls: [],
    finish: "Oak",
    finish_vi: "Gỗ sồi",
    finish_ko: "오크",
    size: "80 x 80 cm",
    product_id: "product-one",
    product_name_denorm: "Chair product",
    product_line: "Classic collection",
    brand_id: "brand-one",
    designer_id: "designer-one",
    designer_name: "Jane Designer",
    brand_cldr_logo: null,
    brand_name_denorm: "Brand",
    category_id: "category-one",
    filter_brand: "brand",
    filter_category: "chairs",
    filter_room: ["living-room"],
    filter_room_vi: ["Phòng khách"],
    filter_room_ko: ["거실"],
    filter_product_line: "Icons",
    media_lifestyle_1: null,
    media_lifestyle_2: null,
    cldr_media_lifestyle_1: null,
    cldr_media_lifestyle_2: null,
    media_long: null,
    media_closeup: null,
    filter_sub_category: "chairs",
    filter_is_new_arrival: false,
    ...overrides,
  }) as VariantProductListItem;

function dependencies(
  rows: readonly CatalogEligibility[] = [eligibility()],
  variants: readonly VariantProductListItem[] = [variant()],
): PublicCatalogAdapterDependencies {
  return {
    loadEligibility: vi.fn(async () => rows),
    searchVariants: vi.fn(async () => variants),
    loadVariantsBySkus: vi.fn(async (skus) =>
      variants.filter((item) => item.sku !== null && skus.includes(item.sku)),
    ),
  };
}

describe("live public catalog chat adapter", () => {
  it("expands Vietnamese product-type queries before the original phrase", () => {
    expect(catalogSearchQueries("Ghế nào phù hợp cho phòng khách?")).toEqual([
      "chair",
      "Ghế nào phù hợp cho phòng khách?",
    ]);
  });

  it("expands English room queries to the catalog product type", () => {
    expect(catalogSearchQueries("living room chair")).toEqual([
      "chair",
      "living room chair",
    ]);
  });

  it("keeps unsupported-media rows parseable without making them eligible", async () => {
    const adapter = createPublicCatalogAdapters(
      "vi",
      dependencies([
        eligibility({ has_supported_media: false, image_url: null }),
      ], [variant({ gallery_urls: null as never })]),
    );

    const records = await adapter.search("Ghế phòng khách", 1);

    expect(records).toEqual([expect.objectContaining({
      variantId: "variant-one",
      image: { id: "variant-one", alt: "Ghế Việt" },
      eligible: false,
      current: true,
    })]);
  });

  it.each([
    ["vi", "Ghế Việt", "/vi/products/ghe-viet", "Gỗ sồi"],
    ["en", "English Chair", "/en/products/english-chair", "Oak"],
    ["ko", "한국 의자", "/ko/products/hangug-yija", "오크"],
  ] as const)(
    "maps canonical %s product cards with localized names and URLs",
    async (locale, title, canonicalLink, finish) => {
      const adapter = createPublicCatalogAdapters(locale, dependencies());

      const records = await adapter.search("chair", 4);

      expect(records).toEqual([
        expect.objectContaining({
          canonicalId: "product-one",
          variantId: "variant-one",
          title,
          canonicalLink,
          image: {
            id: "variant-one",
            alt: title,
            src: "https://res.cloudinary.com/nanohome-web/image/upload/products/chair",
          },
          price: { mode: "fixed", amount: 12_500_000, currency: "VND" },
          stock: { state: "available" },
          attributes: expect.objectContaining({
            dimensions: "80 x 80 cm",
            finish,
            brand: "Brand",
            designer: "Jane Designer",
            category: "chairs",
            collection: "Icons",
            description: locale === "vi" ? "Mô tả tiếng Việt" : locale === "ko" ? "한국어 설명" : "English description",
          }),
          eligible: true,
          current: true,
        }),
      ]);
      expect(records[0]?.attributes.product).toBe(
        locale === "vi" ? "Ghế" : locale === "ko" ? "Chair product" : "Chair",
      );
    },
  );

  it("takes price and stock only from catalog eligibility, never variant display fields", async () => {
    const adapter = createPublicCatalogAdapters(
      "en",
      dependencies([
        eligibility({
          price: null,
          price_mode: "contact",
          stock: 99,
          has_fresh_stock: false,
          storefront: false,
          cart: false,
          payment: false,
        }),
      ]),
    );

    const records = await adapter.search("chair", 1);

    expect(records[0]).toEqual(
      expect.objectContaining({
        price: { mode: "contact" },
        stock: { state: "unknown" },
      }),
    );
    expect(records[0]?.price).not.toEqual({ mode: "fixed", amount: 1, currency: "VND" });
    expect(records[0]?.stock).not.toEqual({ state: "available", quantity: 999 });
  });

  it("resolves exact canonical product and variant IDs for details and comparison", async () => {
    const deps = dependencies();
    const adapter = createPublicCatalogAdapters("ko", deps);

    const details = await adapter.details(["product-one"]);
    const compared = await adapter.compare(
      ["variant-one"],
      ["dimensions", "finish"],
    );

    expect(details.map((record) => record.canonicalId)).toEqual(["product-one"]);
    expect(compared.map((record) => record.variantId)).toEqual(["variant-one"]);
    expect(details[0]?.canonicalLink).toBe("/ko/products/hangug-yija");
    expect(deps.loadEligibility).toHaveBeenCalledOnce();
  });

  it("marks hidden or unapproved catalog rows ineligible before the public tool boundary", async () => {
    const adapter = createPublicCatalogAdapters(
      "en",
      dependencies([
        eligibility({
          recommendation: false,
          catalog_approved_validated: false,
        }),
      ]),
    );

    const records = await adapter.search("chair", 1);

    expect(records[0]).toEqual(
      expect.objectContaining({ eligible: false, current: false }),
    );
  });

  it("fails closed when the eligibility row and canonical variant do not match", async () => {
    const adapter = createPublicCatalogAdapters(
      "en",
      dependencies([eligibility({ variant_id: "different-variant" })]),
    );

    await expect(adapter.search("chair", 1)).resolves.toEqual([]);
  });

  it("propagates cancellation without querying the catalog", async () => {
    const deps = dependencies();
    const adapter = createPublicCatalogAdapters("en", deps);
    const controller = new AbortController();
    controller.abort();

    await expect(adapter.search("chair", 1, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(deps.loadEligibility).not.toHaveBeenCalled();
    expect(deps.searchVariants).not.toHaveBeenCalled();
  });
});
