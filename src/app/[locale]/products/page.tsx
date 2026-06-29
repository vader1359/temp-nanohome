import { setRequestLocale } from "next-intl/server";
import { ProductsPage } from "@/components/products/products-page";
import type { ProductGridItem } from "@/components/products/ProductGrid";
import { firstCloudinaryImage } from "@/lib/image";
import { getBrands } from "@/lib/queries/brands";
import { getVariantProducts } from "@/lib/queries/products";
import type { Variant } from "@/types/db";

interface PageProps {
  params: Promise<{ locale: string }>;
}

const priceFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatPrice(price: Variant["price"]): string {
  if (price === null) {
    return "Liên hệ";
  }

  return priceFormatter.format(Number(price));
}

function variantText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function variantRawText(variant: Variant, key: string): string {
  const raw = variant.raw;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return "";
  }

  return variantText(raw[key]);
}

function getVariantImageUrl(variant: Variant): string {
  return firstCloudinaryImage([
    variant.cloudinary_ids[0],
    variantRawText(variant, "cldr_packshot_url"),
    variantRawText(variant, "cldr_packshot"),
    variant.packshot_url,
    ...variant.gallery_urls,
  ]);
}

function variantToGridItem(variant: Variant, brand?: { logo_url: string | null; name: string }): ProductGridItem {
  const imageUrl = getVariantImageUrl(variant);
  const discount = variant.discount_percent !== null ? `-${variant.discount_percent}%` : null;
  const name = variantText(variant.name_vi, variantText(variant.name, "Sản phẩm"));
  const detailSlug = variantText(variant.slug_vi, variantText(variant.slug, variant.id));

  return {
    id: variant.id,
    brand: brand?.name ?? "nanoHome",
    brandLogoUrl: brand?.logo_url ?? null,
    name,
    subtitle: [variantText(variant.finish_vi, variantText(variant.finish)), variantText(variant.size)].filter(Boolean).join(" / ") || "Sản phẩm",
    status: variant.on_sale ? "SALE" : variant.in_stock ? "CÓ SẴN" : "HẾT HÀNG",
    imageUrl,
    href: `/products/${encodeURIComponent(detailSlug)}`,
    oldPrice: variant.compare_at_price !== null ? formatPrice(variant.compare_at_price) : null,
    discount,
    price: formatPrice(variant.price),
    swatches: [],
  };
}

export default async function ProductsRoute({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [variants, brands] = await Promise.all([getVariantProducts({ pageSize: 24 }), getBrands()]);
  const products = variants.map((variant) => variantToGridItem(variant, variant.brand_id ? brands.find((brand) => brand.id === variant.brand_id) : undefined));
  const brandFilters = brands.map((brand) => ({ id: brand.id, logoUrl: brand.logo_url, name: brand.name }));

  return <ProductsPage brands={brandFilters} products={products} />;
}
