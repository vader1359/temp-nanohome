"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const BRANDS = [
  "B&B Italia",
  "&Tradition",
  "Cassina",
  "Maxalto",
  "USM",
  "Knoll",
  "Poltrona Frau",
  "Minotti",
  "Baxter",
  "De Padova",
  "Flou",
  "Molteni&C",
  "Porada",
  "Zanotta",
  "Ligne Roset",
  "Flexform",
  "Moooi",
];

export function BrandSelector() {
  const t = useTranslations("Products");

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[18px] font-medium leading-[26px] text-nh-ink">
        {t("chooseBrand")}
      </h2>
      <div className="flex flex-wrap items-center gap-4">
        {BRANDS.map((brand, index) => (
          <button
            className={cn(
              "flex h-10 min-w-[92px] items-center justify-center gap-2.5 border border-nh-border px-2.5 text-[12px] font-medium leading-4 text-nh-ink",
              index === 0 ? "bg-white" : "bg-transparent"
            )}
            key={brand}
            type="button"
          >
            {brand}
          </button>
        ))}
      </div>
    </section>
  );
}
