import { getTranslations } from "next-intl/server";
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
import { normalizeSearchQuery } from "@/lib/queries/search-input";
import { firstProductImage } from "@/lib/image";
import { isUsmContactVariant, isUsmVariant } from "@/lib/products/usm";
import { isInStock } from "@/lib/products/availability";
import { isContactPrice } from "@/lib/products/price";
import type { Variant } from "@/types/db";
import { isSupportedLocale, type Locale } from "@/i18n/routing";
import { type CanonicalFilters, PAGE_SIZE } from "./filter-utils";

const FEATURED_FIRST_BRAND = "fritz-hansen";

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
  { slug: "kitchen", vi: "Kitchen", en: "Kitchen", ko: "주ang" }, // note: keep exactly the same as in page.tsx: "Kitchen" for vi, "Kitchen" for en, "주방" for ko
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
  vases: "Bình hoa",
  candles: "Chân nến & nến",
  books: "Sách",
  cushions: "Gối/Cushion",
  throws: "Khăn/Chăn",
  miniatures: "Miniature",
  rugs: "Thảm",
  "home-fragrance": "Home Fragrance",
  organizers: "Organizer",
  "tote-bags": "Tote bag",
  drinkware: "Drinkware",
  pet: "Pet collection",
  decoration: "Decoration",
  "kitchen-textiles": "Kitchen Textiles",
  kids: "For kids",
  "wall-lamps": "Đèn tường",
};

const KOREAN_FACET_LABELS: Record<string, string> = {
  vases: "화병",
  candles: "촛대 & 캔들",
  books: "도서",
  cushions: "쿠션",
  throws: "담요",
  miniatures: "미니어처",
  rugs: "러그",
  "home-fragrance": "홈 프래그런스",
  organizers: "정리함",
  "tote-bags": "토트백",
  drinkware: "음료 용품",
  pet: "반려동물",
  decoration: "장식",
  "kitchen-textiles": "키친 텍스타일",
  kids: "키즈",
};

const ACCESSORIES_SUBCATEGORY_ORDER = [
  "accessories",
  "vases",
  "candles",
  "books",
  "cushions",
  "throws",
  "miniatures",
  "rugs",
  "home-fragrance",
  "organizers",
  "tote-bags",
  "drinkware",
  "pet",
  "decoration",
  "kitchen-textiles",
  "kids",
] as const;

const ACCESSORIES_SUBCATEGORY_RANK = new Map<string, number>(
  ACCESSORIES_SUBCATEGORY_ORDER.map((slug, index) => [slug, index]),
);

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

export function getRoomOptions(locale: Locale) {
  // room.vi could have been updated: room.vi or the specific translation mapping. 
  // Let's use the ROOM_TRANSLATIONS array mapping
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

function facetLabel(
  slug: string,
  locale: Locale,
  categoryBySlug: ReadonlyMap<string, { readonly name: string; readonly name_ko: string | null; readonly name_vi: string | null }>,
): string {
  const category = categoryBySlug.get(slug);
  if (locale === "vi") {
    return variantText(category?.name_vi, VIETNAMESE_FACET_LABELS[slug] ?? titleizeSlug(slug));
  }

  if (locale === "ko") {
    return variantText(category?.name_ko, variantText(category?.name, variantText(category?.name_vi, KOREAN_FACET_LABELS[slug] ?? titleizeSlug(slug))));
  }

  return variantText(category?.name, variantText(category?.name_vi, titleizeSlug(slug)));
}

function getImageUrl(variant: VariantProductListItem): string {
  return firstProductImage([
    variantText(variant.packshot_url),
    ...variant.gallery_urls,
    variantText(variant.cldr_media_lifestyle_1),
    variantText(variant.cldr_media_lifestyle_2),
    variantText(variant.media_long),
    variantText(variant.media_closeup),
  ]) || "/images/p_lc2.png";
}

function mergePreferredBrandFirst(
  preferredVariants: readonly VariantProductListItem[],
  variants: readonly VariantProductListItem[],
): readonly VariantProductListItem[] {
  const seen = new Set<string>();
  const merged: VariantProductListItem[] = [];

  for (const variant of [...preferredVariants, ...variants]) {
    if (seen.has(variant.id)) continue;
    seen.add(variant.id);
    merged.push(variant);
    if (merged.length >= PAGE_SIZE) break;
  }

  return merged;
}

export type ProductPageData = {
  products: ProductGridItem[];
  totalCount: number;
  filters: CanonicalFilters;
  brandOptions: Array<{ id: string; slug: string; name: string; logoUrl: string | null }>;
  categoryOptions: Array<{
    slug: string;
    name: string;
    subCategories: Array<{ slug: string; name: string }>;
  }>;
  roomOptions: Array<{ slug: string; label: string }>;
};

export async function getProductPage(locale: string, filters: CanonicalFilters): Promise<ProductPageData> {
  if (!isSupportedLocale(locale)) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  const supportedLocale = locale;
  // API requests carry the locale as a query parameter rather than through
  // the [locale] route segment, so provide it explicitly to next-intl.
  const t = await getTranslations({ locale: supportedLocale, namespace: "Products" });

  const normalizedRoomsList = normalizeRooms(filters.room);
  const normalizedQuery = filters.q === undefined || filters.q === "" ? undefined : normalizeSearchQuery(filters.q);
  const queryOptions: VariantProductQueryOptions = {
    brand: filters.brand.length > 0 ? filters.brand : undefined,
    category: filters.category.length > 0 ? filters.category : undefined,
    subCategory: filters.subCategory.length > 0 ? filters.subCategory : undefined,
    room: normalizedRoomsList,
    status: filters.status ?? undefined,
    search: normalizedQuery === "" ? undefined : normalizedQuery,
    sort: filters.sort ?? "priority",
    page: filters.page ?? 1,
    pageSize: PAGE_SIZE,
  };
  const shouldPreferFritzHansen =
    queryOptions.sort === "priority" &&
    queryOptions.page === 1 &&
    queryOptions.brand === undefined &&
    queryOptions.search === undefined;
  const preferredBrandQueryOptions: VariantProductQueryOptions = {
    ...queryOptions,
    brand: [FEATURED_FIRST_BRAND],
  };

  const [variants, preferredBrandVariants, totalCount, brands, categories, facets] = await Promise.all([
    getVariantProducts(queryOptions),
    shouldPreferFritzHansen
      ? getVariantProducts(preferredBrandQueryOptions)
      : Promise.resolve([]),
    getVariantProductCount(queryOptions),
    getProductFilterBrands(),
    getCategories(),
    getVariantProductFacets(),
  ]);

  const brandById = new Map(brands.map((b) => [b.id, b]));
  const brandBySlug = new Map(
    brands.flatMap((brand) => (brand.slug ? [[brand.slug, brand], [brand.slug.toLowerCase(), brand]] : [])),
  );
  const categoryBySlug = new Map(categories.flatMap((category) => (category.slug ? [[category.slug, category]] : [])));
  const fmt = buildPriceFormatter(supportedLocale);

  function formatPrice(variant: Pick<VariantProductListItem, "sku" | "stock">, price: Variant["price"]): string {
    if (isUsmContactVariant(variant) || isContactPrice(price) || (Number(price) === 0 && !isUsmVariant(variant))) return t("contactForPrice");
    return fmt.format(Number(price));
  }

  function toGridItem(variant: VariantProductListItem): ProductGridItem {
    const brand = variant.brand_id ? brandById.get(variant.brand_id) : undefined;
    const useContactPrice = isUsmContactVariant(variant) || isContactPrice(variant.price);

    const rawComparePrice = variant.compare_at_price !== null ? Number(variant.compare_at_price) : 0;
    const rawPrice = variant.price !== null ? Number(variant.price) : 0;
    const hasValidDiscount = !useContactPrice && rawPrice > 0 && rawComparePrice > rawPrice;

    const status: ProductStatusKind = (variant.on_sale && hasValidDiscount)
      ? "sale"
      : isInStock(variant)
        ? "in_stock"
        : "out_of_stock";

    return {
      id: variant.id,
      brand: brand?.name ?? variantText(variant.brand_name_denorm, "nanoHome"),
      brandLogoUrl: brand?.logo_url ?? (variantText(variant.brand_cldr_logo) || null),
      brandSlug: variant.filter_brand ?? undefined,
      category: variant.filter_category ?? undefined,
      name: variantText(
        supportedLocale === "ko" ? variant.name_ko : supportedLocale === "vi" ? variant.name_vi : variant.name,
        variantText(
          supportedLocale === "ko" ? variant.name : supportedLocale === "vi" ? variant.name : variant.name_vi,
          supportedLocale === "ko" ? variantText(variant.name_vi, t("defaultProductName")) : t("defaultProductName"),
        ),
      ),
      rooms: variant.filter_room ?? [],
      subCategory: variant.filter_sub_category ?? undefined,
      subtitle: facetLabel(variant.filter_sub_category ?? "", supportedLocale, categoryBySlug),
      status,
      imageUrl: getImageUrl(variant),
      href: variantDetailHref(variant, supportedLocale),
      oldPrice: hasValidDiscount ? formatPrice(variant, variant.compare_at_price) : null,
      discount: hasValidDiscount && variant.discount_percent !== null ? `-${variant.discount_percent}%` : null,
      price: formatPrice(variant, variant.price),
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
    return {
      slug: cat,
      name: facetLabel(cat, supportedLocale, categoryBySlug),
      subCategories: Array.from(subCategorySlugs.entries())
        .filter(([, parentCat]) => parentCat === cat)
        .sort(([leftSlug], [rightSlug]) => {
          if (cat !== "accessories") return leftSlug.localeCompare(rightSlug);
          const leftRank = ACCESSORIES_SUBCATEGORY_RANK.get(leftSlug) ?? Number.MAX_SAFE_INTEGER;
          const rightRank = ACCESSORIES_SUBCATEGORY_RANK.get(rightSlug) ?? Number.MAX_SAFE_INTEGER;
          return leftRank - rightRank || leftSlug.localeCompare(rightSlug);
        })
        .map(([slug]) => {
          return {
            slug,
            name: facetLabel(slug, supportedLocale, categoryBySlug),
          };
        }),
    };
  });

  const roomOptions = getRoomOptions(supportedLocale);

  const prioritizedVariants = shouldPreferFritzHansen
    ? mergePreferredBrandFirst(preferredBrandVariants, variants)
    : variants;
  const products = prioritizedVariants.map(toGridItem);

  return {
    products,
    totalCount,
    filters,
    brandOptions,
    categoryOptions,
    roomOptions,
  };
}
