import { setRequestLocale } from "next-intl/server";
import { Header } from "@/components/header";
import { About } from "@/components/sections/about";
import { Brands } from "@/components/sections/brands";
import { FeaturedProducts } from "@/components/sections/featured-products";
import { Footer } from "@/components/sections/footer";
import { Hero } from "@/components/sections/hero";
import { InstagramGallery } from "@/components/sections/instagram";
import { Newsletter } from "@/components/sections/newsletter";
import { ProductsGrid } from "@/components/sections/products-grid";
import { Rooms } from "@/components/sections/rooms";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-white">
      <Header />
      <Hero />
      <InstagramGallery />
      <ProductsGrid />
      <About />
      <FeaturedProducts />
      <Rooms />
      <Brands />
      <Newsletter />
      <Footer />
    </main>
  );
}
