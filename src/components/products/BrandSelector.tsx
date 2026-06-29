"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
interface BrandSelectorProps {
  brands: readonly { id: string; logoUrl: string | null; name: string }[];
  selectedBrands: Set<string>;
  toggleBrand: (value: string) => void;
}

const FALLBACK_BRANDS = [
  "B&B Italia", "&Tradition", "Cassina", "Maxalto", "USM", "Knoll",
  "Poltrona Frau", "Minotti", "Baxter", "De Padova", "Flou", "Molteni&C",
  "Porada", "Zanotta", "Ligne Roset", "Flexform", "Moooi",
].map((name) => ({ id: name, logoUrl: null, name }));

const LOCAL_LOGOS: Record<string, string> = {
  Knoll: "/images/knoll_logo.png",
  Maxalto: "/images/maxalto_logo.png",
  USM: "/images/usm_logo.png",
  Vitra: "/images/vitra_logo.png",
};

export function BrandSelector({ brands, selectedBrands, toggleBrand }: BrandSelectorProps) {
  const t = useTranslations("Products");
  const items = brands.length > 0 ? brands : FALLBACK_BRANDS;

  return (
    <section className="hidden flex-col gap-4 lg:flex">
      <h2 className="text-[18px] font-medium leading-[26px] text-nh-ink">
        {t("chooseBrand")}
      </h2>
      <div className="flex flex-wrap items-center gap-4">
        {items.map((brand) => {
          const logoUrl = brand.logoUrl ?? LOCAL_LOGOS[brand.name];
          const active = selectedBrands.has(brand.name);

          return (
            <button
              className={cn(
                "group flex h-7 min-w-[68px] items-center justify-center border border-nh-ink bg-transparent px-1.5 transition-colors hover:bg-nh-ink",
                active && "bg-nh-ink",
              )}
              key={brand.id}
              type="button"
              aria-label={brand.name}
              aria-pressed={active}
              onClick={() => toggleBrand(brand.name)}
            >
              {logoUrl ? <Image
                  alt={brand.name}
                  className={cn(
                    "h-3.5 w-auto max-w-[72px] object-contain grayscale contrast-200 brightness-0 transition-[filter] group-hover:brightness-0 group-hover:invert",
                    active && "brightness-0 invert",
                  )}
                  height={14}
                  src={logoUrl}
                  width={120}
                /> : <span className={cn("text-[12px] font-medium leading-4 text-nh-ink transition-colors group-hover:text-white", active && "text-white")}>{brand.name}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
