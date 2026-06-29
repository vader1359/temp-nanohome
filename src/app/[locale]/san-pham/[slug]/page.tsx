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

function getVariantImages(variant: Variant): string[] {
  const images = [getVariantPackshotUrl(variant), ...variant.gallery_urls].filter(isCloudinaryUrl);
  return images.length > 0 ? images : [getVariantPackshotUrl(variant)];
}

function toRelatedProduct(variant: Variant): RelatedProduct {
  return {
    name: variantText(variant.name_vi, variantText(variant.name, "Sản phẩm")),
    brand: "nanoHome",
    category: [variantText(variant.finish_vi, variantText(variant.finish)), variantText(variant.size)].filter(Boolean).join(" / ") || "Sản phẩm",
    price: formatPrice(variant.price),
    image: getVariantPackshotUrl(variant) || variant.gallery_urls[0] || "/images/p_lc2.png",
    available: variant.in_stock,
    tags: variant.on_sale ? ["Sale"] : undefined,
  };
}

function buildHeroProduct(variant: Variant) {
  const gallery = getVariantImages(variant);
  const title = variantText(variant.name_vi, variantText(variant.name, "Sản phẩm"));

  return {
    id: variant.id,
    sku: variantText(variant.sku, variant.id),
    brand: "nanoHome",
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

  const siblingVariants = variant.product_id !== null ? await getVariantsByProductId(variant.product_id) : [];
  const related = siblingVariants.filter((item) => item.id !== variant.id).slice(0, 4).map(toRelatedProduct);
  const recommended = (await getVariantProducts({ pageSize: 4 })).filter((item) => item.id !== variant.id).map(toRelatedProduct);
  const galleryImages = getVariantImages(variant);

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
