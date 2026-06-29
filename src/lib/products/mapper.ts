import type { ProductGridItem } from "@/components/products/ProductGrid";
import type { Variant } from "@/types/db";

const priceFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});

export function formatVndPrice(price: number | null): string {
  if (price === null) {
    return "Liên hệ";
  }

  return priceFormatter.format(Number(price));
}

export function variantText(value: unknown, fallback: string = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function variantRawText(variant: { raw: Variant["raw"] }, key: string): string {
  const raw = variant.raw;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return "";
  }

  return variantText(raw[key]);
}

type ProductGridMapperOptions = {
  brandLogoUrl?: string | null;
  brandName?: string | null;
  packshotOnly?: boolean;
};

type ProductGridVariant = Pick<
  Variant,
  | "id"
  | "name"
  | "name_vi"
  | "slug"
  | "slug_vi"
  | "price"
  | "compare_at_price"
  | "discount_percent"
  | "on_sale"
  | "in_stock"
  | "packshot_url"
  | "gallery_urls"
  | "raw"
>;

export function getProductGridImageUrl(variant: ProductGridVariant, options: ProductGridMapperOptions = {}): string {
  if (options.packshotOnly) {
    return (
      variantRawText(variant, "cldr_packshot_url") ||
      variantRawText(variant, "cldr_packshot") ||
      variantText(variant.packshot_url) ||
      ""
    );
  }

  return (
    variantRawText(variant, "cldr_packshot_url") ||
    variantRawText(variant, "cldr_packshot") ||
    variantText(variant.packshot_url) ||
    variant.gallery_urls?.[0] ||
    "/images/p_lc2.png"
  );
}

export function variantToProductGridItem(variant: ProductGridVariant, options: ProductGridMapperOptions = {}): ProductGridItem {
  const imageUrl = getProductGridImageUrl(variant, options);
  const discount = variant.discount_percent !== null ? `-${variant.discount_percent}%` : null;
  const name = variantText(variant.name_vi, variantText(variant.name, "Sản phẩm"));
  const detailSlug = variantText(variant.slug_vi, variantText(variant.slug, variant.id));

  return {
    id: variant.id,
    brand: options.brandName || "nanoHome",
    brandLogoUrl: options.brandLogoUrl,
    name,
    subtitle: variantRawText(variant, "sub_category") || variantRawText(variant, "filter_sub_category") || variantRawText(variant, "category") || "Loại sản phẩm",
    status: variant.on_sale ? "sale" : variant.in_stock ? "in_stock" : "out_of_stock",
    imageUrl,
    href: `/products/${encodeURIComponent(detailSlug)}`,
    oldPrice: variant.compare_at_price !== null ? formatVndPrice(variant.compare_at_price) : null,
    discount,
    price: formatVndPrice(variant.price),
    swatches: [],
  };
}
