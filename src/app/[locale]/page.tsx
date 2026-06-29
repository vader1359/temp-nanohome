import dynamic from "next/dynamic";
import { setRequestLocale } from "next-intl/server";
import { About } from "@/components/sections/about";
import { Brands } from "@/components/sections/brands";
import { FeaturedProducts } from "@/components/sections/featured-products";
import { Hero } from "@/components/sections/hero";
import { Newsletter } from "@/components/sections/newsletter";
import { ProductsGrid } from "@/components/sections/products-grid";
import { Rooms } from "@/components/sections/rooms";
import { variantToProductGridItem } from "@/lib/products/mapper";
import { getBrands } from "@/lib/queries/brands";
import { getVariantProducts } from "@/lib/queries/products";

const InstagramGallery = dynamic(
  () =>
    import("@/components/sections/instagram").then((m) => m.InstagramGallery),
  { loading: () => <div className="h-[400px]" aria-hidden="true" /> }
);

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [variants, brands] = await Promise.all([
    getVariantProducts({ pageSize: 8 }),
    getBrands(),
  ]);

  const brandById = new Map(brands.map((brand) => [brand.id, brand]));
  const toGridItem = (variant: (typeof variants)[number], options: { packshotOnly?: boolean } = {}) => {
    const brand = variant.brand_id ? brandById.get(variant.brand_id) : undefined;

    return variantToProductGridItem(variant, {
      ...options,
      brandLogoUrl: brand?.logo_url ?? null,
      brandName: brand?.name ?? null,
    });
  };

  const packshotProducts = variants
    .map((v) => toGridItem(v, { packshotOnly: true }))
    .filter((p) => p.imageUrl !== "");
  const gridProducts =
    packshotProducts.length > 0
      ? packshotProducts
      : variants.map((v) => toGridItem(v));

  const heroProducts = gridProducts.slice(0, 3).map((product) => ({
    image: product.imageUrl,
    brand: product.brand,
    name: product.name,
    price: product.price,
  }));

  const featuredSlice = variants.slice(0, 2);
  const featuredPackshot = featuredSlice
    .map((v) => toGridItem(v, { packshotOnly: true }))
    .filter((p) => p.imageUrl !== "");
  const featuredProducts =
    featuredPackshot.length >= 2
      ? featuredPackshot
      : featuredSlice.map((v) => toGridItem(v));

  return (
    <main className="min-h-screen bg-white">
      <Hero products={heroProducts} />
      <InstagramGallery />
      <ProductsGrid products={gridProducts} />
      <About />
      <FeaturedProducts products={featuredProducts} />
      <Rooms />
      <Brands brands={brands.map(({ id, logo_url, name }) => ({ id, logoUrl: logo_url, name }))} />
      <Newsletter />
    </main>
  );
}
