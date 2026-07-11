import { describe, expect, it } from "vitest";

import { koreanBackfillRecords } from "./exporter";

describe("koreanBackfillRecords", () => {
  it("maps only approved Korean targets and emits their Vietnamese sources", () => {
    // Given: a brand with a blank Korean description and unrelated source data.
    const row = {
      id: "brand-1",
      description: "English description",
      description_ko: null,
      description_vi: "Mô tả tiếng Việt",
      origin: "Denmark",
      origin_ko: "Đan Mạch",
      origin_vi: "Đan Mạch",
    };

    // When: the row becomes Korean backfill input.
    const records = koreanBackfillRecords({ table: "brands", row });

    // Then: it contains only the allowlisted, blank target with its preferred source.
    expect(records).toEqual([
      {
        table: "brands",
        id: "brand-1",
        column: "description_ko",
        source: { vi: "Mô tả tiếng Việt" },
      },
    ]);
  });

  it("prefers a nonblank Vietnamese source and falls back to English", () => {
    // Given: products with both sources, then a blank Vietnamese source.
    const vietnamesePreferred = {
      id: "product-vi",
      name: "Chair",
      name_ko: null,
      name_vi: " Ghế ",
      slug: null,
      slug_ko: null,
      slug_vi: null,
      description: null,
      description_ko: null,
      description_vi: null,
    };
    const englishFallback = { ...vietnamesePreferred, id: "product-en", name_vi: "   " };

    // When: both rows are converted.
    const records = [
      ...koreanBackfillRecords({ table: "products", row: vietnamesePreferred }),
      ...koreanBackfillRecords({ table: "products", row: englishFallback }),
    ];

    // Then: Vietnamese wins when meaningful; English fills the otherwise supported gap.
    expect(records).toEqual([
      { table: "products", id: "product-vi", column: "name_ko", source: { vi: "Ghế" } },
      { table: "products", id: "product-en", column: "name_ko", source: { en: "Chair" } },
    ]);
  });

  it("uses the English slug source for Korean route slugs", () => {
    // Given: a product with both locale-specific source slugs.
    const row = {
      id: "product-slug",
      name: null,
      name_ko: "제품",
      name_vi: null,
      slug: "scandinavian-chair",
      slug_ko: null,
      slug_vi: "ghe-bac-au",
      description: null,
      description_ko: null,
      description_vi: null,
    };

    // When: it is converted to Korean backfill input.
    const records = koreanBackfillRecords({ table: "products", row });

    // Then: the Korean route slug retains the canonical Latin/English source.
    expect(records).toEqual([
      { table: "products", id: "product-slug", column: "slug_ko", source: { en: "scandinavian-chair" } },
    ]);
  });

  it("selects only blank Korean targets, including whitespace-only values", () => {
    // Given: a category with an existing Korean value and another with a whitespace-only target.
    const complete = { id: "category-complete", name: "Chair", name_ko: "의자", name_vi: "Ghế" };
    const blank = { ...complete, id: "category-blank", name_ko: "  " };

    // When: the records are produced.
    const records = [
      ...koreanBackfillRecords({ table: "categories", row: complete }),
      ...koreanBackfillRecords({ table: "categories", row: blank }),
    ];

    // Then: existing Korean content is preserved and whitespace is eligible for backfill.
    expect(records).toEqual([
      { table: "categories", id: "category-blank", column: "name_ko", source: { vi: "Ghế" } },
    ]);
  });

  it("keeps array targets as arrays and emits no unsupported fields", () => {
    // Given: a variant with the array target and unrelated columns.
    const row = {
      id: "variant-1",
      name: "Chair",
      name_ko: "의자",
      name_vi: "Ghế",
      short_name: null,
      short_name_ko: null,
      short_name_vi: null,
      slug: null,
      slug_ko: null,
      slug_vi: null,
      description: null,
      description_ko: null,
      description_vi: null,
      meta_title: null,
      meta_title_ko: null,
      meta_title_vi: null,
      meta_description: null,
      meta_description_ko: null,
      meta_description_vi: null,
      finish: null,
      finish_ko: null,
      finish_vi: null,
      designer_description: null,
      designer_description_ko: null,
      designer_description_vi: null,
      brand_origin: null,
      brand_origin_ko: null,
      brand_origin_vi: null,
      cldr_media_closeup_alt: null,
      cldr_media_closeup_alt_ko: null,
      cldr_media_closeup_alt_vi: null,
      cldr_media_lifestyle_1_alt: null,
      cldr_media_lifestyle_1_alt_ko: null,
      cldr_media_lifestyle_1_alt_vi: null,
      cldr_media_lifestyle_2_alt: null,
      cldr_media_lifestyle_2_alt_ko: null,
      cldr_media_lifestyle_2_alt_vi: null,
      cldr_media_long_alt: null,
      cldr_media_long_alt_ko: null,
      cldr_media_long_alt_vi: null,
      cldr_packshot_alt: null,
      cldr_packshot_alt_ko: null,
      cldr_packshot_alt_vi: null,
      filter_room: ["Living room", "Bedroom"],
      filter_room_ko: null,
      filter_room_vi: ["Phòng khách", "Phòng ngủ"],
      internal_note: "must not leak",
    };

    // When: it is converted to JSONL-ready records.
    const records = koreanBackfillRecords({ table: "variants", row });

    // Then: only the contract record is emitted with the typed array source.
    expect(records).toEqual([
      {
        table: "variants",
        id: "variant-1",
        column: "filter_room_ko",
        source: { vi: ["Phòng khách", "Phòng ngủ"] },
      },
    ]);
  });
});
