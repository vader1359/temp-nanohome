import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type QueryResult = { readonly data: readonly Row[] | Row | null; readonly error: Error | null };
type QueryMock = PromiseLike<QueryResult> & {
  readonly eq: ReturnType<typeof vi.fn>;
  readonly is: ReturnType<typeof vi.fn>;
  readonly lte: ReturnType<typeof vi.fn>;
  readonly gte: ReturnType<typeof vi.fn>;
  readonly in: ReturnType<typeof vi.fn>;
  readonly maybeSingle: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
};

const state = vi.hoisted(() => {
  const calls: Array<readonly [string, string]> = [];
  const rows = new Map<string, QueryResult>();
  const builders = new Map<string, QueryMock>();
  const builderFor = (table: string): QueryMock => {
    const existing = builders.get(table);
    if (existing !== undefined) return existing;
    const builder: QueryMock = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      maybeSingle: vi.fn(() => builder),
      order: vi.fn(() => builder),
      then: (resolve) => Promise.resolve(rows.get(table) ?? { data: [], error: null }).then(resolve),
    };
    builders.set(table, builder);
    return builder;
  };

  return {
    calls,
    createPublicClient: vi.fn(() => ({
      from: (table: string) => {
        calls.push(["from", table]);
        return builderFor(table);
      },
    })),
    builders,
    rows,
  };
});

vi.mock("@/lib/supabase/server", () => ({ createPublicClient: state.createPublicClient }));

const cacheState = vi.hoisted(() => ({
  calls: [] as Array<{ readonly keyParts: readonly string[]; readonly options: { readonly tags?: readonly string[]; readonly revalidate?: number } }>,
}));

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((loader: (locale: "en" | "ko" | "vi") => Promise<unknown>, keyParts: readonly string[], options: { readonly tags?: readonly string[]; readonly revalidate?: number }) => {
    cacheState.calls.push({ keyParts, options });
    return loader;
  }),
}));

import { getHomepageCms } from "./homepage-cms";

const media = {
  id: "media-1",
  delivery_url: "https://res.cloudinary.com/nanohome/image/upload/hero.jpg",
  asset_type: "image",
  width: 1600,
  height: 900,
  alt_text: "English hero",
  alt_text_vi: "Hero tiếng Việt",
  alt_text_ko: null,
  focal_x: 50,
  focal_y: 50,
  approved: true,
  validated: true,
};

const variant = {
  id: "variant-1",
  name: "Chair",
  name_vi: "Ghế",
  name_ko: null,
  short_name: "Chair",
  short_name_vi: "Ghế",
  short_name_ko: null,
  slug: "chair",
  slug_vi: "ghe",
  slug_ko: null,
  sku: "CHAIR-1",
  stock: 4,
  price: 100,
  compare_at_price: null,
  discount_percent: null,
  on_sale: false,
  in_stock: true,
  packshot_url: "https://res.cloudinary.com/nanohome/image/upload/chair.jpg",
  gallery_urls: [],
  finish: "Oak",
  finish_vi: "Gỗ sồi",
  finish_ko: null,
  size: null,
  product_id: "product-1",
  brand_id: "brand-1",
  designer_id: null,
  brand_cldr_logo: null,
  brand_name_denorm: "Brand",
  category_id: "category-1",
  filter_brand: "Brand",
  filter_category: "Chair",
  filter_room: ["living-room"],
  filter_room_vi: ["phòng khách"],
  filter_room_ko: null,
  media_lifestyle_1: null,
  media_lifestyle_2: null,
  cldr_media_lifestyle_1: null,
  cldr_media_lifestyle_2: null,
  media_long: null,
  media_closeup: null,
  filter_sub_category: null,
  filter_is_new_arrival: false,
  approved: true,
  validated: true,
};

beforeEach(() => {
  state.calls.length = 0;
  state.rows.clear();
  state.builders.clear();
  cacheState.calls.length = 0;
  vi.clearAllMocks();
});

describe("getHomepageCms", () => {
  it("configures a locale-specific one-hour cache with the invalidation tags", async () => {
    // Given: the public home page lookup has no published page.
    state.rows.set("site_pages", { data: null, error: null });

    // When: the Vietnamese homepage CMS model is loaded.
    await getHomepageCms("vi");

    // Then: cache identity, tags, and safety TTL are locale-specific and explicit.
    expect(cacheState.calls).toHaveLength(1);
    expect(cacheState.calls[0]?.keyParts).toEqual(["homepage", "vi"]);
    expect(cacheState.calls[0]?.options.tags).toEqual(["homepage", "homepage:vi"]);
    expect(cacheState.calls[0]?.options.revalidate).toBe(3600);
  });

  it("uses distinct cache keys for distinct locales", async () => {
    // Given: the public home page lookup has no published page.
    state.rows.set("site_pages", { data: null, error: null });

    // When: English and Korean homepage CMS models are loaded.
    await getHomepageCms("en");
    await getHomepageCms("ko");

    // Then: each locale receives a distinct cache identity and tag.
    expect(cacheState.calls.map(({ keyParts, options }) => ({ keyParts, tags: options.tags }))).toEqual([
      { keyParts: ["homepage", "en"], tags: ["homepage", "homepage:en"] },
      { keyParts: ["homepage", "ko"], tags: ["homepage", "homepage:ko"] },
    ]);
  });

  it("returns an empty model when the published home page is missing", async () => {
    // Given: no published CMS home page is available from the public client.
    state.rows.set("site_pages", { data: null, error: null });

    // When: the English homepage CMS model is loaded.
    const model = await getHomepageCms("en");

    // Then: lookup is scoped to the approved and validated home root.
    expect(state.calls).toEqual([["from", "site_pages"]]);
    expect(state.builders.get("site_pages")?.eq).toHaveBeenCalledWith("slug", "home");
    expect(state.builders.get("site_pages")?.eq).toHaveBeenCalledWith("approved", true);
    expect(state.builders.get("site_pages")?.eq).toHaveBeenCalledWith("validated", true);
    expect(model).toEqual({ sections: [] });
  });

  it("builds ordered sections with localized fallback and published child records", async () => {
    // Given: published CMS records arrive in non-authored order, with invalid and unavailable children.
    state.rows.set("site_pages", { data: { id: "page-1" }, error: null });
    state.rows.set("page_sections", {
      data: [
        { id: "carousel-section", page_id: "page-1", section_type: "content_carousel", sort_order: 2 },
        { id: "hero-section", page_id: "page-1", section_type: "hero", sort_order: 0 },
        { id: "curation-section", page_id: "page-1", section_type: "product_curation", sort_order: 1 },
        { id: "unknown-section", page_id: "page-1", section_type: "unknown", sort_order: 3 },
      ],
      error: null,
    });
    state.rows.set("hero_slides", {
      data: [{ id: "slide-1", section_id: "hero-section", sort_order: 1, title: "English title", title_vi: "Tiêu đề", title_ko: null, body: "Body", body_vi: null, body_ko: null, eyebrow: "Eyebrow", eyebrow_vi: null, eyebrow_ko: null, cta_label: "Shop", cta_label_vi: null, cta_label_ko: null, cta_href: "/shop", desktop_media_id: "media-1", mobile_media_id: null, overlay_strength: 0.2 }],
      error: null,
    });
    state.rows.set("hero_hotspots", {
      data: [
        { id: "hotspot-valid", hero_slide_id: "slide-1", variant_id: "variant-1", x_percent: 10, y_percent: 20, placement: "left", sort_order: 1 },
        { id: "hotspot-invalid", hero_slide_id: "slide-1", variant_id: "variant-1", x_percent: 10, y_percent: 20, placement: "center", sort_order: 2 },
      ],
      error: null,
    });
    state.rows.set("media_assets", { data: [media, { ...media, id: "video-1", asset_type: "video" }], error: null });
    state.rows.set("product_curations", { data: [{ id: "curation-1", section_id: "curation-section", title: "Products", title_vi: null, title_ko: "상품", hide_out_of_stock: true }], error: null });
    state.rows.set("product_curation_items", { data: [{ id: "item-1", curation_id: "curation-1", variant_id: "variant-1", sort_order: 0 }, { id: "item-2", curation_id: "curation-1", variant_id: "variant-2", sort_order: 1 }], error: null });
    state.rows.set("variants", { data: [variant, { ...variant, id: "variant-2", in_stock: false }], error: null });
    state.rows.set("content_carousels", { data: [{ id: "carousel-1", section_id: "carousel-section", title: "English carousel", title_vi: null, title_ko: "캐러셀" }], error: null });
    state.rows.set("content_carousel_items", { data: [{ id: "content-1", carousel_id: "carousel-1", media_id: "media-1", sort_order: 0, title: "Card", title_vi: null, title_ko: null, body: null, body_vi: "Nội dung", body_ko: null, href: "/card" }], error: null });

    // When: the Vietnamese homepage CMS model is loaded.
    const model = await getHomepageCms("vi");

    // Then: authored order, Vietnamese fallback, approved image media, stock policy, and valid hotspots are preserved.
    expect(model.sections.map((section) => section.type)).toEqual(["hero", "product_curation", "content_carousel"]);
    expect(model.sections[0]).toMatchObject({ type: "hero" });
    expect(model.sections[1]).toMatchObject({ type: "product_curation", title: "Products", items: [variant] });
    expect(model.sections[2]).toMatchObject({ type: "content_carousel", title: "English carousel" });
    expect(model.sections[0]?.type === "hero" ? model.sections[0].slides[0]?.hotspots : []).toEqual([
      { id: "hotspot-valid", variantId: "variant-1", xPercent: 10, yPercent: 20, placement: "left" },
    ]);
    expect(model.sections[0]?.type === "hero" ? model.sections[0].slides[0]?.ctaLabel : undefined).toBe("Shop");
    expect(state.builders.get("variants")?.eq).toHaveBeenCalledWith("validated", true);
    expect(state.builders.get("variants")?.eq).not.toHaveBeenCalledWith("approved", true);
  });
});
