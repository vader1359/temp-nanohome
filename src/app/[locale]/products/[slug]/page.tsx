import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Section1Hero } from "@/components/product-detail/section-1-hero";
import { Section2Specs } from "@/components/product-detail/section-2-specs";
import { Section3Related } from "@/components/product-detail/section-3-related";
import { Section4Gallery } from "@/components/product-detail/section-4-gallery";
import { Section5Benefits } from "@/components/product-detail/section-5-benefits";
import { Section6Recommended } from "@/components/product-detail/section-6-recommended";
import type { RelatedProduct } from "@/components/product-detail/mock-data";
import { COLORS } from "@/components/product-detail/mock-data";
import { getVariantProducts, type VariantProductListItem } from "@/lib/queries/products";
import { variantDetailHref } from "@/lib/queries/variant-url";
import { getVariantBySlug, getVariantsByProductId } from "@/lib/queries/variants";
import type { Variant } from "@/types/db";

interface ProductPageProps {
  params: Promise<{ locale: string; slug: string }>;
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

type VariantRawSource = { readonly raw?: unknown };

function variantRawText(variant: VariantRawSource, key: string): string {
  const raw = variant.raw;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return "";
  }

  return variantText((raw as Record<string, unknown>)[key]);
}

function getVariantPackshotUrl(variant: Pick<Variant, "packshot_url"> & { readonly raw?: unknown }): string {
  return (
    variantRawText(variant, "cldr_packshot_url") ||
    variantRawText(variant, "cldr_packshot") ||
    variantText(variant.packshot_url)
  );
}

function getVariantBrandLogoUrl(variant: Pick<Variant, "brand_cldr_logo"> & { readonly raw?: unknown }): string {
  return variantText(variant.brand_cldr_logo) || variantRawText(variant, "brand_cldr_logo") || variantRawText(variant, "brand_logo");
}

function getVariantLifestyleImages(
  variant: Pick<Variant, "media_lifestyle_1" | "media_lifestyle_2" | "cldr_media_lifestyle_1" | "cldr_media_lifestyle_2" | "media_long" | "media_closeup" | "gallery_urls">,
): string[] {
  return [
    variantText(variant.media_lifestyle_1),
    variantText(variant.media_lifestyle_2),
    variantText(variant.cldr_media_lifestyle_1),
    variantText(variant.cldr_media_lifestyle_2),
    variantText(variant.media_long),
    variantText(variant.media_closeup),
    ...variant.gallery_urls,
  ].filter((url): url is string => Boolean(url));
}

function getVariantImages(variant: Variant): string[] {
  return [getVariantPackshotUrl(variant), ...variant.gallery_urls].filter((url): url is string => Boolean(url));
}

type RelatedVariant = Pick<
  Variant,
  | "id"
  | "name"
  | "slug"
  | "slug_vi"
  | "price"
  | "on_sale"
  | "in_stock"
  | "packshot_url"
  | "gallery_urls"
  | "finish"
  | "finish_vi"
  | "size"
  | "brand_name_denorm"
  | "media_lifestyle_1"
  | "media_lifestyle_2"
  | "cldr_media_lifestyle_1"
  | "cldr_media_lifestyle_2"
  | "media_long"
  | "media_closeup"
>;

function toRelatedProduct(variant: RelatedVariant | VariantProductListItem): RelatedProduct {
  return {
    name: variantText(variant.name, "Sản phẩm"),
    brand: variantText(variant.brand_name_denorm, "nanoHome"),
    category: [variantText(variant.finish_vi, variantText(variant.finish)), variantText(variant.size)].filter(Boolean).join(" / ") || "Sản phẩm",
    price: formatPrice(variant.price),
    image: getVariantPackshotUrl(variant) || variant.gallery_urls[0] || "/images/p_lc2.png",
    available: variant.in_stock,
    href: variantDetailHref(variant),
    tags: variant.on_sale ? ["Sale"] : undefined,
  };
}

function buildHeroProduct(variant: Variant) {
  const gallery = getVariantImages(variant);
  const title = variantText(variant.name_vi, variantText(variant.name, "Sản phẩm"));

  return {
    id: variant.id,
    sku: variantText(variant.sku, variant.id),
    brand: variantText(variant.brand_name_denorm, "nanoHome"),
    brandLogoUrl: getVariantBrandLogoUrl(variant),
    title,
    breadcrumbTitle: title,
    category: [variantText(variant.finish_vi, variantText(variant.finish)), variantText(variant.size)].filter(Boolean).join(" / ") || "Sản phẩm",
    onSale: variant.on_sale,
    oldPrice: variant.compare_at_price !== null ? formatPrice(variant.compare_at_price) : "",
    newPrice: formatPrice(variant.price),
    discount: variant.discount_percent !== null ? `-${variant.discount_percent}%` : "",
    colors: COLORS,
    gallery: gallery.length > 0 ? gallery : ["/images/p_lc2.png"],
  };
}

function buildSpecColumns(variant: Variant) {
  return [
    [
      { label: "Tên sản phẩm", value: variantText(variant.name_vi, variantText(variant.name, "Sản phẩm")) },
      { label: "SKU", value: variantText(variant.sku, "Đang cập nhật") },
      { label: "Tình trạng", value: variant.in_stock ? "Đang có hàng" : "Hết hàng" },
      { label: "Hoàn thiện", value: variantText(variant.finish_vi, variantText(variant.finish, "Đang cập nhật")) },
    ],
    [
      { label: "Kích thước", value: variantText(variant.size, "Đang cập nhật") },
      { label: "Giá", value: formatPrice(variant.price) },
      { label: "Giảm giá", value: variant.discount_percent !== null ? `${variant.discount_percent}%` : "Không" },
      { label: "Mã sản phẩm", value: variant.id },
    ],
  ];
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const variant = await getVariantBySlug(decodeURIComponent(slug));
  if (variant === null) {
    notFound();
  }

  const [siblingVariants, similarCategoryVariants, recommendedVariants] = await Promise.all([
    variant.product_id !== null ? getVariantsByProductId(variant.product_id) : Promise.resolve([]),
    getVariantProducts({ categoryId: variant.category_id, excludeId: variant.id, pageSize: 8 }),
    getVariantProducts({ excludeId: variant.id, pageSize: 4 }),
  ]);
  const relatedSource = similarCategoryVariants.length > 0 ? similarCategoryVariants : siblingVariants.filter((item) => item.id !== variant.id);
  const related = relatedSource.slice(0, 8).map(toRelatedProduct);
  const recommended = recommendedVariants.map(toRelatedProduct);
  const galleryImages = getVariantLifestyleImages(variant);

  return (
    <main className="flex flex-col">
      <Section1Hero product={buildHeroProduct(variant)} />
      <Section2Specs
        specColumns={buildSpecColumns(variant)}
        description={variant.meta_description}
        designerDescription="Thông tin nhà thiết kế sẽ được cập nhật."
      />
      <Section3Related products={related} collectionName={variantText(variant.finish_vi, variantText(variant.finish, "Cùng dòng"))} />
      <Section4Gallery galleryImages={galleryImages.length > 0 ? galleryImages : undefined} />
      <Section5Benefits />
      <Section6Recommended products={recommended} />
    </main>
  );
}
