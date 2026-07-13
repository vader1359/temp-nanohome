import { ProductGrid, type ProductGridItem, type ProductStatusKind } from "@/components/products/ProductGrid";
import type { Locale } from "@/i18n/routing";
import { firstCloudinaryImage } from "@/lib/image";
import type { VariantProductListItem } from "@/lib/queries/products";
import { variantDetailHref } from "@/lib/queries/variant-url";

function variantText(value: string | null, fallback = ""): string {
  return value === null || value === "" ? fallback : value;
}

function localizedVariantName(variant: VariantProductListItem, locale: Locale): string {
  if (locale === "ko") {
    return variantText(variant.name_ko, variantText(variant.name, variantText(variant.name_vi, "nanoHome")));
  }
  if (locale === "vi") {
    return variantText(variant.name_vi, variantText(variant.name, "nanoHome"));
  }
  return variantText(variant.name, variantText(variant.name_vi, "nanoHome"));
}

const CONTACT_LABELS: Record<string, string> = {
  vi: "Liên hệ",
  ko: "가격 문의",
  en: "Contact for price",
};

function formatPrice(value: number | null, locale: Locale): string {
  if (value === null || value === 0) {
    return CONTACT_LABELS[locale] ?? "Contact for price";
  }
  return new Intl.NumberFormat(locale === "ko" ? "ko-KR" : locale === "vi" ? "vi-VN" : "en-US", {
    currency: "VND",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

const VIETNAMESE_FACET_LABELS: Record<string, string> = {
  chairs: "Ghế",
  decor: "Trang trí",
  desks: "Bàn làm việc",
  easy: "Ghế bành",
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

function formatSubtitle(rawSubtitle: string | null, locale: Locale): string {
  if (!rawSubtitle) return "Loại sản phẩm";
  const slug = rawSubtitle.toLowerCase().trim();
  if (locale === "vi" && VIETNAMESE_FACET_LABELS[slug]) {
    return VIETNAMESE_FACET_LABELS[slug];
  }
  return titleizeSlug(rawSubtitle);
}

function toProductGridItem(variant: VariantProductListItem, locale: Locale): ProductGridItem {
  const useContactPrice = variant.price === null || variant.price === 0;

  const rawComparePrice = variant.compare_at_price !== null ? Number(variant.compare_at_price) : 0;
  const rawPrice = variant.price !== null ? Number(variant.price) : 0;
  const hasValidDiscount = !useContactPrice && rawPrice > 0 && rawComparePrice > rawPrice;

  const status: ProductStatusKind = (variant.on_sale && hasValidDiscount)
    ? "sale"
    : variant.in_stock
      ? "in_stock"
      : "out_of_stock";

  const rawSubtitle = variantText(variant.filter_sub_category, variantText(variant.filter_category));
  const subtitle = formatSubtitle(rawSubtitle, locale);

  return {
    id: variant.id,
    brand: variantText(variant.brand_name_denorm, "nanoHome"),
    brandLogoUrl: variant.brand_cldr_logo,
    brandSlug: variant.filter_brand ?? undefined,
    category: variant.filter_category ?? undefined,
    name: localizedVariantName(variant, locale),
    rooms: variant.filter_room ?? [],
    searchVariantId: variant.id,
    subCategory: variant.filter_sub_category ?? undefined,
    subtitle,
    status,
    imageUrl: firstCloudinaryImage([
      variant.packshot_url,
      ...variant.gallery_urls,
      variant.cldr_media_lifestyle_1,
      variant.cldr_media_lifestyle_2,
      variant.media_long,
      variant.media_closeup,
    ]) || "/images/p_lc2.png",
    href: variantDetailHref(variant, locale),
    oldPrice: hasValidDiscount ? formatPrice(variant.compare_at_price, locale) : null,
    discount: hasValidDiscount && variant.discount_percent !== null ? `-${variant.discount_percent}%` : null,
    price: formatPrice(variant.price, locale),
    swatches: [],
  };
}

export function SearchProductGrid({ locale, variants }: Readonly<{ readonly locale: Locale; readonly variants: readonly VariantProductListItem[] }>) {
  return (
    <ProductGrid
      products={variants.map((variant) => toProductGridItem(variant, locale))}
      gridClassName="grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4"
    />
  );
}
