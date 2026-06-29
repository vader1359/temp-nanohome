import { unstable_cache } from "next/cache";
import { z } from "zod";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProductsPage } from "@/components/products/products-page";
import type { ProductGridItem, ProductStatusKind } from "@/components/products/ProductGrid";
import { getProductFilterBrands } from "@/lib/queries/brands";
import { getCategories } from "@/lib/queries/categories";
import {
  getVariantProducts,
  getVariantProductCount,
  getVariantProductFacets,
  type VariantProductListItem,
  type VariantProductQueryOptions,
} from "@/lib/queries/products";
import { variantDetailHref } from "@/lib/queries/variant-url";
import { firstCloudinaryImage } from "@/lib/image";
import type { Variant } from "@/types/db";
import type { Locale } from "@/i18n/routing";

const PAGE_SIZE = 24;

const FilterSchema = z.object({
  brand: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (Array.isArray(v) ? v : v ? [v] : undefined)),
  category: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (Array.isArray(v) ? v : v ? [v] : undefined)),
  subCategory: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (Array.isArray(v) ? v : v ? [v] : undefined)),
  room: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (Array.isArray(v) ? v : v ? [v] : undefined)),
  status: z.enum(["in_stock", "sale", "out_of_stock"]).optional().nullable(),
  q: z.string().optional(),
  sort: z.enum(["priority", "price_asc", "price_desc", "newest"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

const getCachedBrands = unstable_cache(getProductFilterBrands, ["product-filter-brands-v1"], { revalidate: 3600 });

const getCachedCategories = unstable_cache(getCategories, ["categories-v2"], { revalidate: 3600 });

const getCachedFacets = unstable_cache(getVariantProductFacets, ["variant-facets-v2"], {
  revalidate: 300,
});

const getCachedVariantProducts = unstable_cache(getVariantProducts, ["variant-products-v2"], {
  revalidate: 60,
});

const getCachedVariantProductCount = unstable_cache(getVariantProductCount, ["variant-product-count-v2"], {
  revalidate: 60,
});

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const NUMBER_FORMAT_LOCALE: Record<Locale, string> = {
  vi: "vi-VN",
  en: "en-US",
  ko: "ko-KR",
};

function buildPriceFormatter(locale: Locale): Intl.NumberFormat {
  return new Intl.NumberFormat(NUMBER_FORMAT_LOCALE[locale], {
    currency: "VND",
    maximumFractionDigits: 0,
    style: "currency",
  });
}

function variantText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

const ROOM_TRANSLATIONS = [
  { slug: "living-room", vi: "Phòng khách", en: "Living Room", ko: "거실" },
  { slug: "family-room", vi: "Phòng gia đình", en: "Family Room", ko: "가족 방" },
  { slug: "bedroom", vi: "Phòng ngủ", en: "Bedroom", ko: "침실" },
  { slug: "dining-room", vi: "Phòng ăn", en: "Dining Room", ko: "다이닝룸" },
  { slug: "office", vi: "Văn phòng", en: "Office", ko: "작업 공간" },
  { slug: "kitchen", vi: "Kitchen", en: "Kitchen", ko: "주방" },
  { slug: "outdoor", vi: "Ngoài trời", en: "Outdoor", ko: "야외" },
] as const;

const VIETNAMESE_FACET_LABELS: Record<string, string> = {
  accessories: "Phụ kiện",
  "architectural-lighting": "Đèn kiến trúc",
  cabinets: "Tủ kệ",
  chairs: "Ghế",
  floor: "Đèn sàn",
  "floor-lamps": "Đèn sàn",
  furniture: "Nội thất",
  lighting: "Đèn",
  lounges: "Ghế thư giãn",
  outdoor: "Ngoài trời",
  pendants: "Đèn treo thả",
  sofas: "Ghế sofa",
  "table-lamps": "Đèn bàn",
  tables: "Bàn",
  usm: "USM",
  "wall-lamps": "Đèn tường",
};

function titleizeSlug(value: string): string {
  const special: Record<string, string> = {
    hay: "HAY",
    usm: "USM",
    flos: "FLOS",
    vitra: "VITRA",
    "and-tradition": "&Tradition",
    "bd-barcelona-design": "BD Barcelona Design",
  };
  if (special[value] !== undefined) return special[value];
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getRoomOptions(locale: Locale) {
  return ROOM_TRANSLATIONS.map(({ slug, vi, en, ko }) => ({ slug, label: { vi, en, ko }[locale] }));
}

function normalizeRooms(values: readonly string[] | undefined): readonly string[] | undefined {
  if (values === undefined) return undefined;
  const labelToSlug = new Map<string, string>();
  for (const room of ROOM_TRANSLATIONS) {
    labelToSlug.set(room.slug, room.slug);
    labelToSlug.set(room.vi, room.slug);
    labelToSlug.set(room.en, room.slug);
    labelToSlug.set(room.ko, room.slug);
  }
  return values.map((value) => labelToSlug.get(value) ?? value);
}

function facetLabel(slug: string, locale: Locale, categoryBySlug: ReadonlyMap<string, { readonly name: string; readonly name_vi: string | null }>): string {
  const category = categoryBySlug.get(slug);
  if (locale === "vi") {
    return variantText(category?.name_vi, VIETNAMESE_FACET_LABELS[slug] ?? titleizeSlug(slug));
  }

  return variantText(category?.name, titleizeSlug(slug));
}

function getImageUrl(variant: VariantProductListItem): string {
  return firstCloudinaryImage([
    variantText(variant.packshot_url),
    ...variant.gallery_urls,
    variantText(variant.cldr_media_lifestyle_1),
    variantText(variant.cldr_media_lifestyle_2),
    variantText(variant.media_long),
    variantText(variant.media_closeup),
  ]) || "/images/p_lc2.png";
}

export default async function ProductsRoute({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supportedLocale = locale as Locale;
  const t = await getTranslations("Products");
  const sp = await searchParams;
  const parsed = FilterSchema.safeParse(sp);
  const filters = parsed.success ? parsed.data : {};

  const normalizedRooms = normalizeRooms(filters.room);
  const queryOptions: VariantProductQueryOptions = {
    brand: filters.brand,
    category: filters.category,
    subCategory: filters.subCategory,
    room: normalizedRooms,
    status: filters.status ?? undefined,
    search: filters.q,
    sort: filters.sort ?? "priority",
    page: filters.page ?? 1,
    pageSize: PAGE_SIZE,
  };

  const [variants, totalCount, brands, categories, facets] = await Promise.all([
    getCachedVariantProducts(queryOptions),
    getCachedVariantProductCount(queryOptions),
    getCachedBrands(),
    getCachedCategories(),
    getCachedFacets(),
  ]);

  const brandById = new Map(brands.map((b) => [b.id, b]));
  const brandBySlug = new Map(
    brands.flatMap((brand) => (brand.slug ? [[brand.slug, brand], [brand.slug.toLowerCase(), brand]] : [])),
  );
  const categoryBySlug = new Map(categories.flatMap((category) => (category.slug ? [[category.slug, category]] : [])));
  const fmt = buildPriceFormatter(supportedLocale);

  function formatPrice(price: Variant["price"]): string {
    if (price === null) return t("contactForPrice");
    return fmt.format(Number(price));
  }

  function toGridItem(variant: VariantProductListItem): ProductGridItem {
    const brand = variant.brand_id ? brandById.get(variant.brand_id) : undefined;
    const status: ProductStatusKind = variant.on_sale
      ? "sale"
      : variant.in_stock
        ? "in_stock"
        : "out_of_stock";

    return {
      id: variant.id,
      brand: brand?.name ?? variantText(variant.brand_name_denorm, "nanoHome"),
      brandLogoUrl: brand?.logo_url ?? (variantText(variant.brand_cldr_logo) || null),
      brandSlug: variant.filter_brand ?? undefined,
      category: variant.filter_category ?? undefined,
      name: variantText(supportedLocale === "vi" ? (variant.name_vi ?? "") : variant.name, t("defaultProductName")),
      rooms: variant.filter_room ?? [],
      subCategory: variant.filter_sub_category ?? undefined,
      subtitle: facetLabel(variant.filter_sub_category ?? "", supportedLocale, categoryBySlug),
      status,
      imageUrl: getImageUrl(variant),
      href: variantDetailHref(variant),
      oldPrice: variant.compare_at_price !== null ? formatPrice(variant.compare_at_price) : null,
      discount: variant.discount_percent !== null ? `-${variant.discount_percent}%` : null,
      price: formatPrice(variant.price),
      swatches: [],
    };
  }

  // Build unique facet options from all approved+validated variants
  const brandSlugs = new Set<string>();
  const categorySlugs = new Set<string>();
  const subCategorySlugs = new Map<string, string>();

  for (const facet of facets) {
    if (facet.filter_brand) brandSlugs.add(facet.filter_brand);
    if (facet.filter_category) categorySlugs.add(facet.filter_category);
    if (facet.filter_sub_category) {
      subCategorySlugs.set(facet.filter_sub_category, facet.filter_category ?? "");
    }
  }

  const brandOptions = Array.from(brandSlugs)
    .sort()
    .map((slug) => {
      const brand = brandBySlug.get(slug) ?? brandBySlug.get(slug.toLowerCase());
      return {
        id: brand?.id ?? slug,
        slug,
        name: brand?.name ?? titleizeSlug(slug),
        logoUrl: brand?.logo_url ?? null,
      };
    });

  const categoryOptions = Array.from(categorySlugs).map((cat) => {
    const category = categoryBySlug.get(cat);
    return {
      slug: cat,
      name: facetLabel(cat, supportedLocale, categoryBySlug),
      subCategories: Array.from(subCategorySlugs.entries())
        .filter(([, parentCat]) => parentCat === cat)
        .map(([slug]) => {
          const subCategory = categoryBySlug.get(slug);
          return {
            slug,
            name: facetLabel(slug, supportedLocale, categoryBySlug),
          };
        }),
    };
  });

  const roomOptions = getRoomOptions(supportedLocale);

  const products = variants.map(toGridItem);

  return (
    <ProductsPage
      brandOptions={brandOptions}
      categoryOptions={categoryOptions}
      roomOptions={roomOptions}
      products={products}
      currentFilters={{
        brand: filters.brand ?? [],
        category: filters.category ?? [],
        subCategory: filters.subCategory ?? [],
        room: normalizedRooms ?? [],
        status: filters.status ?? null,
        q: filters.q ?? "",
        sort: filters.sort ?? "priority",
        page: filters.page ?? 1,
      }}
      totalCount={totalCount}
      pageSize={PAGE_SIZE}
    />
  );
}
