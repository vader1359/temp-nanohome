import { setRequestLocale } from "next-intl/server";
import { About } from "@/components/sections/about";
import { Brands } from "@/components/sections/brands";
import { DeferredInstagramGallery } from "@/components/sections/deferred-instagram-gallery";
import { FeaturedProducts } from "@/components/sections/featured-products";
import { Hero } from "@/components/sections/hero";
import { Newsletter } from "@/components/sections/newsletter";
import { ProductsGrid } from "@/components/sections/products-grid";
import { Rooms } from "@/components/sections/rooms";
import { variantToProductGridItem } from "@/lib/products/mapper";
import { getBrands } from "@/lib/queries/brands";
import { getVariantProducts, getVariantProductsBySkus } from "@/lib/queries/products";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export const revalidate = 3600;

const TRENDING_SKUS = [
  "LPLLP00025", // PH Artichoke
  "CHRFH00142", // Series 7, different variant from Trending
  "CHRVT00009", // Panton Chair, different variant from Trending
  "CLGKN00001", // Barcelona Lounge Chair
  "USMUS00269", // USM Haller
  "LFLLP00004", // Panthella
  "LTLFL00027", // Snoopy
  "LTLML00005", // Pipistrello
] as const;

const BEST_SELLER_SKUS = [
  "CHRFH00149", // Series 7
  "LPLLP00032", // PH 5
  "LTLAT00024", // VP9
  "CHRVT00008", // Panton Chair
  "ACCFH00004", // Ikebana Vase
  "ACCCA00021", // Cassina accessory
  "USMUS00080", // USM Haller cabinet, different variant from Trending
  "LTLLP00064", // Panthella
] as const;

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [trendingRaw, bestSellerRaw, newArrivalRaw, chairVariants, lampVariants, brands, featuredRaw] = await Promise.all([
    getVariantProductsBySkus(TRENDING_SKUS),
    getVariantProductsBySkus(BEST_SELLER_SKUS),
    getVariantProducts({
      pageSize: 36,
      status: "new_arrival",
    }),
    getVariantProducts({ pageSize: 12, sort: "priority", subCategory: ["chairs"] }),
    getVariantProducts({ pageSize: 12, sort: "priority", subCategory: ["table-lamps", "floor-lamps", "pendants", "wall-lamps", "lighting"] }),
    getBrands(),
    getVariantProductsBySkus(["USMUS00087", "ACCFH00004"]),
  ]);

  let finalNewArrivalRaw = newArrivalRaw;
  if (finalNewArrivalRaw.length === 0) {
    finalNewArrivalRaw = await getVariantProducts({
      pageSize: 36,
      status: "new_arrival",
    });
  }
  if (finalNewArrivalRaw.length === 0) {
    finalNewArrivalRaw = trendingRaw;
  }

  const brandById = new Map(brands.map((brand) => [brand.id, brand]));
  const toGridItem = (variant: (typeof trendingRaw)[number], options: { packshotOnly?: boolean } = {}) => {
    const brand = variant.brand_id ? brandById.get(variant.brand_id) : undefined;

    return variantToProductGridItem(variant, {
      ...options,
      brandLogoUrl: brand?.logo_url ?? null,
      brandName: brand?.name ?? null,
      locale,
    });
  };

  const getRandomSubset = <T,>(arr: readonly T[], n: number): readonly T[] => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
  };

  const trendingBySku = new Map(trendingRaw.map((variant) => [variant.sku, variant]));
  const trendingSelected = TRENDING_SKUS
    .map((sku) => trendingBySku.get(sku))
    .filter((variant): variant is (typeof trendingRaw)[number] => variant?.in_stock === true);
  const bestSellerBySku = new Map(bestSellerRaw.map((variant) => [variant.sku, variant]));
  const bestSellerSelected = BEST_SELLER_SKUS
    .map((sku) => bestSellerBySku.get(sku))
    .filter((variant): variant is (typeof bestSellerRaw)[number] => variant?.in_stock === true);

  const newArrivalSelected = getRandomSubset(finalNewArrivalRaw, Math.min(8, finalNewArrivalRaw.length));

  const mapToGridItems = (variants: readonly (typeof trendingRaw)[number][]) => {
    const packshot = variants
      .map((v) => toGridItem(v, { packshotOnly: true }))
      .filter((p) => p.imageUrl !== "");
    return packshot.length > 0 ? packshot : variants.map((v) => toGridItem(v));
  };

  const trendingProducts = mapToGridItems(trendingSelected);
  const bestSellerProducts = mapToGridItems(bestSellerSelected);
  const newArrivalProducts = mapToGridItems(newArrivalSelected);

  const heroProducts = trendingProducts.slice(0, 3).map((product) => ({
    image: product.imageUrl,
    brand: product.brand,
    name: product.name,
    price: product.oldPrice || product.price,
  }));

  const usmVariant = featuredRaw.find((v) => v.sku === "USMUS00087");
  const ikebanaVariant = featuredRaw.find((v) => v.sku === "ACCFH00004");

  let featuredProducts = [
    usmVariant ? toGridItem(usmVariant) : undefined,
    ikebanaVariant ? toGridItem(ikebanaVariant) : undefined,
  ].filter((p): p is ReturnType<typeof toGridItem> => p !== undefined);

  if (featuredProducts.length < 2) {
    const featuredSlice = [
      chairVariants[0] ?? trendingRaw[0],
      lampVariants[0] ?? trendingRaw[1] ?? trendingRaw[0],
    ].filter((variant): variant is (typeof trendingRaw)[number] => variant !== undefined);
    const featuredPackshot = featuredSlice
      .map((v) => toGridItem(v, { packshotOnly: true }))
      .filter((p) => p.imageUrl !== "");
    featuredProducts =
      featuredPackshot.length >= 2
        ? featuredPackshot
        : featuredSlice.map((v) => toGridItem(v));
  }

  return (
    <main className="min-h-screen bg-white">
      <Hero products={heroProducts} />
      <DeferredInstagramGallery />
      <ProductsGrid
        trendingProducts={trendingProducts}
        bestSellerProducts={bestSellerProducts}
        newArrivalProducts={newArrivalProducts}
      />
      <About />
      <FeaturedProducts products={featuredProducts} />
      <Rooms />
      <Brands brands={brands.map(({ id, logo_url, name }) => ({ id, logoUrl: logo_url, name }))} />
      <Newsletter />
    </main>
  );
}
