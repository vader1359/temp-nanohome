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
import { firstCloudinaryImage, isCloudinaryUrl } from "@/lib/image";
import { getBrands } from "@/lib/queries/brands";
import { getVariantProducts } from "@/lib/queries/products";
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

function variantRawText(variant: Variant, key: string): string {
  const raw = variant.raw;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return "";
  }

  return variantText(raw[key]);
}

function getVariantPackshotUrl(variant: Variant): string {
  return firstCloudinaryImage([
    variant.cloudinary_ids[0],
    variantRawText(variant, "cldr_packshot_url"),
    variantRawText(variant, "cldr_packshot"),
    variant.packshot_url,
    ...variant.gallery_urls,
  ]);
}

function getVariantLifestyleImages(variant: Variant): string[] {
  const lifestyleFields = [
    ["cldr_media_long", "cldr_long_url", "cldr_long"],
    ["cldr_media_closeup", "cldr_closeup_url", "cldr_closeup"],
    ["cldr_media_lifestyle_1", "cldr_lifestyle1_url", "cldr_lifestyle1"],
    ["cldr_media_lifestyle_2", "cldr_lifestyle2_url", "cldr_lifestyle2"],
    ["cldr_media_illustration", "cldr_illustration_url", "cldr_illustration"],
  ];

  return lifestyleFields
    .map((keys) => keys.map((key) => variantRawText(variant, key)).find(Boolean) ?? "")
    .filter(isCloudinaryUrl);
}

function getVariantImages(variant: Variant): string[] {
  const images = [getVariantPackshotUrl(variant), ...variant.gallery_urls, ...getVariantLifestyleImages(variant)].filter(isCloudinaryUrl);
  return images.length > 0 ? images : [getVariantPackshotUrl(variant)];
}

function toRelatedProduct(variant: Variant): RelatedProduct {
  const detailSlug = variantText(variant.slug_vi, variantText(variant.slug, variant.id));

  return {
    name: variantText(variant.name_vi, variantText(variant.name, "Sản phẩm")),
    brand: "nanoHome",
    category: [variantText(variant.finish_vi, variantText(variant.finish)), variantText(variant.size)].filter(Boolean).join(" / ") || "Sản phẩm",
    price: formatPrice(variant.price),
    image: getVariantPackshotUrl(variant) || "/images/p_lc2.png",
    href: `/products/${encodeURIComponent(detailSlug)}`,
    available: variant.in_stock,
    tags: variant.on_sale ? ["Sale"] : undefined,
  };
}

function buildHeroProduct(variant: Variant, brand?: { logo_url: string | null; name: string }) {
  const gallery = getVariantImages(variant);
  const title = variantText(variant.name_vi, variantText(variant.name, "Sản phẩm"));

  return {
    brand: brand?.name ?? "nanoHome",
    brandLogoUrl: brand?.logo_url ?? null,
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

  const [siblingVariants, recommendedVariants, brands] = await Promise.all([
    variant.product_id !== null ? getVariantsByProductId(variant.product_id) : Promise.resolve([]),
    getVariantProducts({ pageSize: 24 }),
    getBrands(),
  ]);
  const brand = variant.brand_id ? brands.find((item) => item.id === variant.brand_id) : undefined;
  const similarCategoryVariants = recommendedVariants
    .filter((item) => item.id !== variant.id)
    .filter((item) => variant.category_id === null || item.category_id === variant.category_id);
  const relatedSource = similarCategoryVariants.length > 0 ? similarCategoryVariants : siblingVariants.filter((item) => item.id !== variant.id);
  const related = relatedSource.slice(0, 8).map(toRelatedProduct);
  const basePrice = typeof variant.price === "number" ? variant.price : Number(variant.price ?? 0);
  const recommended = similarCategoryVariants
    .sort((a, b) => Math.abs(Number(a.price ?? 0) - basePrice) - Math.abs(Number(b.price ?? 0) - basePrice))
    .slice(0, 8)
    .map(toRelatedProduct);
  const lifestyleImages = getVariantLifestyleImages(variant);

  return (
    <main className="flex flex-col">
      <Section1Hero product={buildHeroProduct(variant, brand)} />
      <Section2Specs
        specColumns={buildSpecColumns(variant)}
        description={variant.meta_description}
        designerDescription="Thông tin nhà thiết kế sẽ được cập nhật."
      />
      <Section3Related products={related} collectionName={variantText(variant.finish_vi, variantText(variant.finish, "Cùng dòng"))} />
      <Section4Gallery galleryImages={lifestyleImages.length > 0 ? lifestyleImages : undefined} />
      <Section5Benefits />
      <Section6Recommended products={recommended} />
    </main>
  );
}
