import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

interface ProductLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}

export const metadata: Metadata = {
  title: "Fauteuil Grand Confort, petit modèle (LC2) — nanoHome",
  description: "Sản phẩm chi tiết — nanoHome",
};

export default async function ProductLayout({ children, params }: ProductLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <div style={{ fontFamily: "var(--font-libre-franklin)" }}>{children}</div>;
}