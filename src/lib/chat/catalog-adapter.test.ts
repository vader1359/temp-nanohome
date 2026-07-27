import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const remoteFetch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://catalog-test.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  },
}));
vi.mock("@/lib/remote-read-only", () => ({
  supabaseReadOnlyFetch: remoteFetch,
}));

import {
  catalogSearchQueries,
  createPublicCatalogAdapters,
  searchPublicChatCatalogVariants,
  type PublicCatalogAdapterDependencies,
} from "./catalog-adapter";

type RpcVariant = Awaited<
  ReturnType<PublicCatalogAdapterDependencies["searchVariants"]>
>[number];

const variant = (
  overrides: Partial<RpcVariant> = {},
): RpcVariant =>
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
    packshot_url:
      "https://res.cloudinary.com/nanohome-web/image/upload/products/chair",
    gallery_urls: [],
    finish: "Oak",
    finish_vi: "Gỗ sồi",
    finish_ko: "오크",
    size: "80 x 80 cm",
    product_id: "product-one",
    product_name: "Chair",
    localized_product_name: "Ghế",
    product_name_denorm: "Chair product",
    product_line: "Classic collection",
    designer_name: "Jane Designer",
    brand_name: "Brand",
    filter_category: "chairs",
    filter_product_line: "Icons",
    cldr_media_lifestyle_1: null,
    cldr_media_lifestyle_2: null,
    media_long: null,
    media_closeup: null,
    public_price: 12_500_000,
    public_price_mode: "fixed",
    public_stock_state: "available",
    is_recommendable: true,
    is_current: true,
    ...overrides,
  }) as RpcVariant;

const publicRpcVariantFields = [
  "id",
  "name",
  "name_vi",
  "name_ko",
  "description",
  "description_vi",
  "description_ko",
  "designer_description",
  "designer_description_vi",
  "designer_description_ko",
  "short_name",
  "short_name_vi",
  "short_name_ko",
  "slug",
  "slug_vi",
  "slug_ko",
  "packshot_url",
  "gallery_urls",
  "finish",
  "finish_vi",
  "finish_ko",
  "size",
  "product_name_denorm",
  "product_line",
  "designer_name",
  "filter_category",
  "filter_product_line",
  "cldr_media_lifestyle_1",
  "cldr_media_lifestyle_2",
  "media_long",
  "media_closeup",
  "product_id",
  "product_name",
  "localized_product_name",
  "brand_name",
  "public_price",
  "public_price_mode",
  "public_stock_state",
  "is_recommendable",
  "is_current",
] as const;

function publicRpcVariant(): Readonly<Record<string, unknown>> {
  const source = variant();
  return Object.fromEntries(
    publicRpcVariantFields.map((field) => [field, source[field]]),
  );
}

function dependencies(
  variants: readonly RpcVariant[] = [variant()],
): PublicCatalogAdapterDependencies {
  return {
    searchVariants: vi.fn(async () => variants),
  };
}

describe("live public catalog chat adapter", () => {
  beforeEach(() => {
    remoteFetch.mockReset();
  });

  it("keeps the full Vietnamese request before its product-type alias", () => {
    expect(catalogSearchQueries("Ghế nào phù hợp cho phòng khách?")).toEqual([
      "Ghế nào phù hợp cho phòng khách?",
      "chair",
    ]);
  });

  it("keeps the full English request before its product-type alias", () => {
    expect(catalogSearchQueries("living room chair")).toEqual([
      "living room chair",
      "chair",
    ]);
  });

  it("keeps the full Korean request before its product-type alias", () => {
    expect(catalogSearchQueries("거실에 어울리는 의자")).toEqual([
      "거실에 어울리는 의자",
      "chair",
    ]);
  });

  it("queries the filtered public catalog RPC over a bounded read-only GET", async () => {
    remoteFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([
        publicRpcVariant(),
        { id: "", name: "Malformed row" },
        { ...publicRpcVariant(), id: "variant-with-raw", raw: { internal: true } },
      ]), { status: 200 }),
    );
    const controller = new AbortController();

    const records = await searchPublicChatCatalogVariants(
      "  Ghế & bàn  ",
      99,
      controller.signal,
    );

    expect(records.map((record) => record.id)).toEqual(["variant-one"]);
    expect(remoteFetch).toHaveBeenCalledOnce();
    const [input, init] = remoteFetch.mock.calls[0] as [URL, RequestInit];
    const endpoint = new URL(input.toString());
    expect(endpoint.origin).toBe("https://catalog-test.supabase.co");
    expect(endpoint.pathname).toBe("/rest/v1/rpc/search_public_chat_catalog");
    expect(endpoint.searchParams.get("search_query")).toBe("Ghế & bàn");
    expect(endpoint.searchParams.get("result_limit")).toBe("12");
    expect(init.method).toBeUndefined();
    expect(init.signal).toBe(controller.signal);
  });

  it("keeps the public RPC projection allowlisted and filters eligibility before limit", () => {
    const sql = readFileSync(
      "supabase/migrations/20260723100000_add_public_chat_catalog_search.sql",
      "utf8",
    );
    const eligibilityGate = sql.indexOf(
      "coalesce(eligibility.recommendation, false) = true",
    );
    const resultLimit = sql.lastIndexOf("limit least(");

    expect(sql).toContain("returns table (");
    expect(sql).not.toMatch(/select\s+variant\.\*/iu);
    expect(sql).not.toMatch(/\braw\b/iu);
    expect(eligibilityGate).toBeGreaterThan(-1);
    expect(resultLimit).toBeGreaterThan(eligibilityGate);
  });

  it("bounds direct anonymous catalog search input inside PostgreSQL", () => {
    const initialSql = readFileSync(
      "supabase/migrations/20260723100000_add_public_chat_catalog_search.sql",
      "utf8",
    );
    const hardeningSql = readFileSync(
      "supabase/migrations/20260723110000_harden_public_chat_catalog_search_query.sql",
      "utf8",
    );

    expect(initialSql).toContain(
      "lower(left(btrim(coalesce(search_query, '')), 240))",
    );
    expect(hardeningSql).toContain(
      "lower(left(btrim(coalesce(search_query, '')), 240))",
    );
    expect(hardeningSql).toContain(
      "create or replace function public.search_public_chat_catalog",
    );
  });

  it("uses a server-only coarse RPC projection instead of downloading the eligibility view", () => {
    const adapterSource = readFileSync("src/lib/chat/catalog-adapter.ts", "utf8");
    const boundarySql = readFileSync(
      "supabase/migrations/20260723120000_secure_public_chat_catalog_boundary.sql",
      "utf8",
    );
    const placeholderPriceSql = readFileSync(
      "supabase/migrations/20260723130000_hide_public_chat_placeholder_prices.sql",
      "utf8",
    );

    expect(adapterSource).not.toContain("getCatalogEligibility");
    expect(adapterSource).not.toContain("catalog_eligibility?select=*");
    expect(boundarySql).toContain(
      "revoke all on public.catalog_eligibility from public, anon, authenticated",
    );
    expect(boundarySql).toContain(
      "grant select on public.catalog_eligibility to service_role",
    );
    expect(boundarySql).toContain("public_stock_state text");
    expect(boundarySql).toContain("public_price_mode text");
    expect(boundarySql).not.toMatch(/\b(?:stock|reason_codes|sku)\s+(?:integer|numeric|text)\b/iu);
    expect(placeholderPriceSql).toContain(
      "searched.public_price between 0 and 1 then null",
    );
    expect(placeholderPriceSql).toContain(
      "searched.public_price between 0 and 1 then 'contact'",
    );
    expect(placeholderPriceSql).toContain(
      "revoke all on function public.search_public_chat_catalog_before_placeholder_price_guard",
    );
  });

  it("rejects broad one-character scans but permits exact identifiers", () => {
    const sql = readFileSync(
      "supabase/migrations/20260723120000_secure_public_chat_catalog_boundary.sql",
      "utf8",
    );

    expect(sql).toContain("char_length(query.term) >= 2");
    expect(sql).toContain("variant.id = query.identifier");
    expect(sql).toContain("variant.product_id = query.identifier");
    expect(sql).toContain("then term::uuid");
    expect(sql).toContain("lower(coalesce(variant.sku, '')) = query.term");
    expect(sql).toContain("set statement_timeout = '4s'");
    expect(sql).toContain(
      "revoke all on function public.search_public_chat_catalog(text, integer)",
    );
    expect(sql).toContain("to anon, authenticated, service_role");
  });

  it("keeps unsupported-media rows parseable without making them eligible", async () => {
    const adapter = createPublicCatalogAdapters(
      "vi",
      dependencies([
        variant({
          packshot_url: null,
          gallery_urls: [],
          is_recommendable: false,
        }),
      ]),
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
        variant({
          public_price: null,
          public_price_mode: "contact",
          public_stock_state: "unknown",
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

  it.each([0, 1])(
    "treats the catalog placeholder price %s as contact-only",
    async (publicPrice) => {
      const adapter = createPublicCatalogAdapters(
        "vi",
        dependencies([
          variant({
            public_price: publicPrice,
            public_price_mode: "fixed",
          }),
        ]),
      );

      const records = await adapter.search("ghế", 1);

      expect(records[0]?.price).toEqual({ mode: "contact" });
    },
  );

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
    expect(deps.searchVariants).toHaveBeenCalledWith("product-one", 12, undefined);
    expect(deps.searchVariants).toHaveBeenCalledWith("variant-one", 12, undefined);
  });

  it("marks hidden or unapproved catalog rows ineligible before the public tool boundary", async () => {
    const adapter = createPublicCatalogAdapters(
      "en",
      dependencies([
        variant({
          is_recommendable: false,
          is_current: false,
        }),
      ]),
    );

    const records = await adapter.search("chair", 1);

    expect(records[0]).toEqual(
      expect.objectContaining({ eligible: false, current: false }),
    );
  });

  it("fails closed when an exact canonical lookup returns a different product", async () => {
    const adapter = createPublicCatalogAdapters(
      "en",
      dependencies([variant({ product_id: "different-product" })]),
    );

    await expect(adapter.details(["product-one"])).resolves.toEqual([]);
  });

  it("keeps an alias result when an optional expanded query temporarily fails", async () => {
    const deps = dependencies();
    const searchVariants = vi.fn(async (query: string) => {
      if (query === "chair") return [variant()];
      throw new Error("temporary expanded-query failure");
    });
    const adapter = createPublicCatalogAdapters("vi", {
      ...deps,
      searchVariants,
    });

    const records = await adapter.search(
      "Ghế nào phù hợp cho phòng khách?",
      8,
    );

    expect(searchVariants).toHaveBeenCalledTimes(3);
    expect(records).toEqual([
      expect.objectContaining({ variantId: "variant-one", eligible: true }),
    ]);
  });

  it("retries one transient RPC read before returning catalog cards", async () => {
    const searchVariants = vi.fn()
      .mockRejectedValueOnce(new Error("temporary catalog failure"))
      .mockResolvedValueOnce([variant()]);
    const adapter = createPublicCatalogAdapters("en", {
      searchVariants,
    });

    await expect(adapter.search("chair", 8)).resolves.toEqual([
      expect.objectContaining({ variantId: "variant-one", eligible: true }),
    ]);
    expect(searchVariants).toHaveBeenCalledTimes(2);
  });

  it("reports the catalog unavailable when every search candidate fails", async () => {
    const deps = dependencies();
    const adapter = createPublicCatalogAdapters("vi", {
      ...deps,
      searchVariants: vi.fn(async () => {
        throw new Error("catalog unavailable");
      }),
    });

    await expect(
      adapter.search("Ghế nào phù hợp cho phòng khách?", 8),
    ).rejects.toThrow("catalog unavailable");
  });

  it("propagates cancellation without querying the catalog", async () => {
    const deps = dependencies();
    const adapter = createPublicCatalogAdapters("en", deps);
    const controller = new AbortController();
    controller.abort();

    await expect(adapter.search("chair", 1, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(deps.searchVariants).not.toHaveBeenCalled();
  });
});
