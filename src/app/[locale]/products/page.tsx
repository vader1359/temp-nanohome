import { setRequestLocale } from "next-intl/server";
import { ProductsPage } from "@/components/products/products-page";
import { variantToProductGridItem } from "@/lib/products/mapper";
import { getBrands } from "@/lib/queries/brands";
import { getVariantProducts } from "@/lib/queries/products";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ProductsRoute({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [variants, brands] = await Promise.all([
    getVariantProducts({ pageSize: 24 }),
    getBrands(),
  ]);
  const brandById = new Map(brands.map((brand) => [brand.id, brand]));
  const products = variants.map((variant) => {
    const brand = variant.brand_id ? brandById.get(variant.brand_id) : undefined;

    return variantToProductGridItem(variant, {
      brandLogoUrl: brand?.logo_url ?? null,
      brandName: brand?.name ?? null,
    });
  });

  return (
    <ProductsPage
      brands={brands.map(({ id, logo_url, name }) => ({ id, logoUrl: logo_url, name }))}
      products={products}
    />
  );
}
