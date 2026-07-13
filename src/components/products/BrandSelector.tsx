"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { BrandOption } from "./products-page";

interface BrandSelectorProps {
  brandOptions: readonly BrandOption[];
  selectedBrands: Set<string>;
  toggleBrand: (value: string) => void;
}

function keepsOriginalLogoColor(brand: BrandOption): boolean {
  const brandKey = `${brand.slug} ${brand.name}`.toLowerCase();
  return brandKey.includes("usm") || brandKey.includes("unite") || brandKey.includes("volta");
}

export function BrandSelector({ brandOptions, selectedBrands, toggleBrand }: BrandSelectorProps) {
  const t = useTranslations("Products");

  return (
    <section className="hidden flex-col gap-4 lg:flex">
      <h2 className="text-[18px] font-medium leading-[26px] text-nh-ink">
        {t("chooseBrand")}
      </h2>
      {brandOptions.length === 0 ? (
        <p className="text-[12px] text-nh-muted">{t("filterWarningEmpty")}</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {brandOptions.map((brand) => {
            const active = selectedBrands.has(brand.slug);
            const preserveLogoColor = keepsOriginalLogoColor(brand);
            const logoUrl = (brand.slug === "usm" || brand.name.toLowerCase() === "usm") ? "/images/usm_logo.png" : brand.logoUrl;

            return (
              <button
                className={cn(
                  "group flex h-10 w-full items-center justify-center border border-nh-ink bg-transparent px-2 transition-colors hover:bg-nh-ink",
                  active && "bg-nh-ink",
                )}
                data-filter-brand=""
                data-filter-value={brand.slug}
                data-testid={`brand-filter-${brand.slug}`}
                key={brand.slug}
                type="button"
                aria-label={brand.name}
                aria-pressed={active}
                onClick={() => toggleBrand(brand.slug)}
              >
                {logoUrl ? (
                  <span className="relative h-5 w-[100px]">
                    <Image
                      alt={brand.name}
                      className={cn(
                        "object-contain transition-[filter]",
                        preserveLogoColor
                          ? ""
                          : "grayscale contrast-200 brightness-0 group-hover:brightness-0 group-hover:invert",
                        active && !preserveLogoColor && "brightness-0 invert",
                      )}
                      fill
                      sizes="100px"
                      src={logoUrl}
                    />
                  </span>
                ) : (
                  <span className={cn("text-[11px] font-medium leading-4 text-nh-ink transition-colors group-hover:text-white", active && "text-white")}>{brand.name}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
