export type ProductStatusKind = "in_stock" | "out_of_stock" | "sale" | "unknown";

export type ProductGridItem = Readonly<{
  id: string;
  brand: string;
  brandLogoUrl?: string | null;
  brandSlug?: string;
  category?: string;
  name: string;
  rooms?: readonly string[];
  searchVariantId?: string;
  subCategory?: string;
  subtitle: string;
  status: ProductStatusKind;
  imageUrl: string;
  imageAlt?: string;
  href: string;
  oldPrice: string | null;
  discount: string | null;
  price: string;
  swatches: readonly string[];
}>;
