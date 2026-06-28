"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

interface SectionHeaderProps {
  sortBy: string;
}

export function SectionHeader({ sortBy }: SectionHeaderProps) {
  const t = useTranslations("Products");
  const sortLabel = sortBy === "recommended" ? t("sortRecommended") : sortBy;

  return (
    <section className="sticky top-0 z-10 flex w-full items-center justify-between bg-white py-4">
      <h1 className="text-left text-[18px] font-medium leading-[26px] text-nh-ink">
        {t("title")}
      </h1>
      <button className="flex items-center gap-2 bg-white text-left" type="button">
        <span className="text-[14px] font-normal leading-5 text-nh-muted">{t("sortBy")}</span>
        <span className="text-[14px] font-medium uppercase leading-5 tracking-[0.04em] text-nh-ink">
          {sortLabel}
        </span>
        <span className="flex size-7 items-center justify-center bg-white">
          <ChevronDown className="size-4 text-nh-ink" />
        </span>
      </button>
    </section>
  );
}
