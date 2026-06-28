import type { Metadata } from "next";
import { Libre_Franklin } from "next/font/google";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

// Libre Franklin is the typeface used throughout the Figma design.
const libreFranklin = Libre_Franklin({
  subsets: ["latin"],
  variable: "--font-libre-franklin",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

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
  return (
    <div
      className={`${libreFranklin.variable}`}
      style={{ fontFamily: "var(--font-libre-franklin)" }}
    >
      {children}
    </div>
  );
}