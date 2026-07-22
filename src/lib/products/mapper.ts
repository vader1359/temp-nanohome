import type { ProductGridItem } from "@/components/products/ProductGrid";
import { isUsmContactVariant, isUsmVariant } from "@/lib/products/usm";
import { isInStock } from "@/lib/products/availability";
import { isContactPrice } from "@/lib/products/price";
import type { Variant } from "@/types/db";

const priceFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});

export function formatVndPrice(price: number | null): string {
  if (isContactPrice(price)) {
    return "Liên hệ";
  }

  if (Number(price) === 0) {
    return "Contact Us";
  }

  return priceFormatter.format(Number(price));
}

export function variantText(value: unknown, fallback: string = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function variantRawText(variant: { readonly raw?: Variant["raw"] | null }, key: string): string {
  const raw = variant.raw;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return "";
  }

  return variantText(raw[key]);
}

const VIETNAMESE_FACET_LABELS: Record<string, string> = {
  accessories: "Phụ kiện",
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
  vases: "Bình hoa",
  candles: "Chân nến & nến",
  books: "Sách",
  cushions: "Gối",
  throws: "Khăn & chăn",
  miniatures: "Mô hình thu nhỏ",
  rugs: "Thảm",
  "home-fragrance": "Hương thơm nhà cửa",
  organizers: "Đồ lưu trữ & sắp xếp",
  "tote-bags": "Túi tote",
  drinkware: "Ly & bình nước",
  pet: "Bộ sưu tập thú cưng",
  decoration: "Đồ trang trí",
  "kitchen-textiles": "Đồ vải nhà bếp",
  kids: "Dành cho trẻ em",
  "wall-lamps": "Đèn tường",
};

const ENGLISH_FACET_LABELS: Record<string, string> = {
  accessories: "Accessories",
  vases: "Vases",
  candles: "Candles & Candle Holders",
  books: "Books",
  cushions: "Cushions",
  throws: "Throws & Blankets",
  miniatures: "Miniatures",
  rugs: "Rugs",
  "home-fragrance": "Home Fragrance",
  organizers: "Organizers",
  "tote-bags": "Tote Bags",
  drinkware: "Drinkware",
  pet: "Pet Collection",
  decoration: "Decoration",
  "kitchen-textiles": "Kitchen Textiles",
  kids: "For Kids",
};

const KOREAN_FACET_LABELS: Record<string, string> = {
  accessories: "액세서리",
  vases: "화병",
  candles: "촛대 & 캔들",
  books: "도서",
  cushions: "쿠션",
  throws: "담요",
  miniatures: "미니어처",
  rugs: "러그",
  "home-fragrance": "홈 프래그런스",
  organizers: "수납 & 정리용품",
  "tote-bags": "토트백",
  drinkware: "컵 & 물병",
  pet: "반려동물 컬렉션",
  decoration: "장식 소품",
  "kitchen-textiles": "키친 텍스타일",
  kids: "어린이용",
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

function formatSubtitle(rawSubtitle: string, locale?: string): string {
  if (!rawSubtitle) return "Loại sản phẩm";
  const slug = rawSubtitle.toLowerCase().trim();
  if (locale === "vi" && VIETNAMESE_FACET_LABELS[slug]) {
    return VIETNAMESE_FACET_LABELS[slug];
  }
  if (locale === "ko" && KOREAN_FACET_LABELS[slug]) {
    return KOREAN_FACET_LABELS[slug];
  }
  if (locale === "en" && ENGLISH_FACET_LABELS[slug]) {
    return ENGLISH_FACET_LABELS[slug];
  }
  return titleizeSlug(rawSubtitle);
}

type ProductGridMapperOptions = {
  brandLogoUrl?: string | null;
  brandName?: string | null;
  packshotOnly?: boolean;
  locale?: string;
};

type ProductGridVariant = Pick<
  Variant,
  | "id"
  | "name"
  | "name_vi"
  | "slug"
  | "slug_vi"
  | "sku"
  | "stock"
  | "price"
  | "compare_at_price"
  | "discount_percent"
  | "on_sale"
  | "in_stock"
  | "packshot_url"
  | "gallery_urls"
> & { readonly raw?: Variant["raw"] };

export function getProductGridImageUrl(variant: ProductGridVariant, options: ProductGridMapperOptions = {}): string {
  if (options.packshotOnly) {
    return (
      variantRawText(variant, "cldr_packshot_url") ||
      variantRawText(variant, "cldr_packshot") ||
      variantText(variant.packshot_url) ||
      "/images/p_lc2.png"
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
  const useContactPrice = isUsmContactVariant(variant) || isContactPrice(variant.price);

  const rawComparePrice = variant.compare_at_price !== null ? Number(variant.compare_at_price) : 0;
  const rawPrice = variant.price !== null ? Number(variant.price) : 0;
  const hasValidDiscount = !useContactPrice && rawPrice > 0 && rawComparePrice > rawPrice;

  const discount = hasValidDiscount && variant.discount_percent !== null ? `-${variant.discount_percent}%` : null;
  const name = variantText(variant.name_vi, variantText(variant.name, "Sản phẩm"));
  const detailSlug = variantText(variant.slug_vi, variantText(variant.slug, variant.id));

  const rawSubtitle = variantRawText(variant, "sub_category") || variantRawText(variant, "filter_sub_category") || variantRawText(variant, "category");
  const subtitle = formatSubtitle(rawSubtitle, options.locale);

  const status = (variant.on_sale && hasValidDiscount) ? "sale" : isInStock(variant) ? "in_stock" : "out_of_stock";

  return {
    id: variant.id,
    brand: options.brandName || "nanoHome",
    brandLogoUrl: options.brandLogoUrl,
    name,
    subtitle,
    status,
    imageUrl,
    href: `/products/${encodeURIComponent(detailSlug)}`,
    oldPrice: hasValidDiscount ? formatVndPrice(variant.compare_at_price) : null,
    discount,
    price: useContactPrice
      ? formatVndPrice(null)
      : isUsmVariant(variant) && variant.price !== null
        ? priceFormatter.format(Number(variant.price))
        : formatVndPrice(variant.price),
    swatches: [],
  };
}
