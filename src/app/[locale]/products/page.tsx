import { setRequestLocale } from "next-intl/server";
import { ProductsPage } from "@/components/products/products-page";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ProductsRoute({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProductsPage />;
}
