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

function variantStatus(variant: VariantProductListItem): ProductStatusKind {
  if (variant.on_sale) {
    return "sale";
  }
  return variant.in_stock ? "in_stock" : "out_of_stock";
}

function formatPrice(value: number | null, locale: Locale): string {
  if (value === null || value === 0) {
    return "Contact for price";
  }
  return new Intl.NumberFormat(locale === "ko" ? "ko-KR" : locale === "vi" ? "vi-VN" : "en-US", {
    currency: "VND",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function toProductGridItem(variant: VariantProductListItem, locale: Locale): ProductGridItem {
  const isContactPrice = variant.price === null || variant.price === 0;
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
    subtitle: variantText(variant.filter_sub_category, variantText(variant.filter_category)),
    status: variantStatus(variant),
    imageUrl: firstCloudinaryImage([
      variant.packshot_url,
      ...variant.gallery_urls,
      variant.cldr_media_lifestyle_1,
      variant.cldr_media_lifestyle_2,
      variant.media_long,
      variant.media_closeup,
    ]) || "/images/p_lc2.png",
    href: variantDetailHref(variant, locale),
    oldPrice: isContactPrice ? null : formatPrice(variant.compare_at_price, locale),
    discount: isContactPrice || variant.discount_percent === null ? null : `-${variant.discount_percent}%`,
    price: formatPrice(variant.price, locale),
    swatches: [],
  };
}

export function SearchProductGrid({ locale, variants }: Readonly<{ readonly locale: Locale; readonly variants: readonly VariantProductListItem[] }>) {
  return <ProductGrid products={variants.map((variant) => toProductGridItem(variant, locale))} />;
}
