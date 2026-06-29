"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandLogoItem = { id: string; logoUrl: string | null; name: string };

const FALLBACK_BRANDS: BrandLogoItem[] = [
  { id: "cassina", logoUrl: null, name: "Cassina" },
  { id: "bb-italia", logoUrl: null, name: "B&B Italia" },
  { id: "maxalto", logoUrl: "/images/maxalto_logo.png", name: "Maxalto" },
  { id: "fritz-hansen", logoUrl: null, name: "Fritz Hansen" },
  { id: "usm", logoUrl: "/images/usm_logo.png", name: "USM" },
  { id: "vitra", logoUrl: "/images/vitra_logo.png", name: "Vitra" },
  { id: "knoll", logoUrl: "/images/knoll_logo.png", name: "Knoll" },
  { id: "and-tradition", logoUrl: null, name: "&Tradition" },
  { id: "flos", logoUrl: null, name: "Flos" },
];

function BrandLogo({ brand }: { brand: BrandLogoItem }) {
  if (!brand.logoUrl) {
    return <span className="min-w-[112px] whitespace-nowrap text-center text-sm font-semibold uppercase tracking-wide">{brand.name}</span>;
  }

  return (
    <span className="flex h-12 min-w-[136px] items-center justify-center">
      <Image
        src={brand.logoUrl!}
        alt={brand.name}
        width={128}
        height={48}
        className="h-10 w-auto max-w-[156px] object-contain grayscale contrast-200 brightness-0"
      />
    </span>
  );
}

export function Brands({ brands }: { brands: readonly BrandLogoItem[] }) {
  const t = useTranslations("Brands");
  const logoBrands = brands.length > 0 ? brands : FALLBACK_BRANDS;

  return (
    <section className="flex flex-col items-center gap-[30px] bg-white py-12 sm:py-16 lg:py-20">
      <style>{`@keyframes brand-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(calc(-50% - 1.75rem)); } }`}</style>
      <div className="site-shell">
        <p className="text-center text-sm font-medium uppercase leading-5 text-[#111111]">
          {t("eyebrow")}
        </p>
      </div>

      <div className="relative w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div
          className={cn(
            "flex w-max flex-nowrap items-center gap-8 motion-safe:animate-[brand-marquee_50s_linear_infinite] lg:gap-14",
            "text-[#111111]",
          )}
        >
          {[...logoBrands, ...logoBrands].map((brand, index) => (
            <BrandLogo key={`${brand.id}-${index}`} brand={brand} />
          ))}
        </div>
        <div className="pointer-events-none absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-white to-transparent lg:hidden" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white to-transparent lg:hidden" />
      </div>
    </section>
  );
}
