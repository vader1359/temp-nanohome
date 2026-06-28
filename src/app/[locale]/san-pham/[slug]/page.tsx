import { setRequestLocale } from "next-intl/server";
import { Section1Hero } from "@/components/product-detail/section-1-hero";
import { Section2Specs } from "@/components/product-detail/section-2-specs";
import { Section3Related } from "@/components/product-detail/section-3-related";
import { Section4Gallery } from "@/components/product-detail/section-4-gallery";
import { Section5Benefits } from "@/components/product-detail/section-5-benefits";
import { Section6Recommended } from "@/components/product-detail/section-6-recommended";

interface ProductPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="flex flex-col">
      <Section1Hero />
      <Section2Specs />
      <Section3Related />
      <Section4Gallery />
      <Section5Benefits />
      <Section6Recommended />
    </main>
  );
}