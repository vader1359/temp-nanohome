import dynamic from "next/dynamic";
import { setRequestLocale } from "next-intl/server";
import { About } from "@/components/sections/about";
import { Brands } from "@/components/sections/brands";
import { FeaturedProducts } from "@/components/sections/featured-products";
import { Hero } from "@/components/sections/hero";
import { Newsletter } from "@/components/sections/newsletter";
import { ProductsGrid } from "@/components/sections/products-grid";
import { Rooms } from "@/components/sections/rooms";

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

  return (
    <main className="min-h-screen bg-white">
      <Hero />
      <InstagramGallery />
      <ProductsGrid />
      <About />
      <FeaturedProducts />
      <Rooms />
      <Brands />
      <Newsletter />
    </main>
  );
}
