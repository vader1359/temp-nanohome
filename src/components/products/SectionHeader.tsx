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
    <section className="sticky top-0 z-10 flex w-full flex-col items-start justify-between gap-3 bg-white py-4 min-[380px]:flex-row min-[380px]:items-center">
      <h1 className="text-left text-[18px] font-medium leading-[26px] text-nh-ink">
        {t("title")}
      </h1>
      <button className="flex max-w-full items-center gap-2 bg-white text-left" type="button">
        <span className="text-[14px] font-normal leading-5 text-nh-muted">{t("sortBy")}</span>
        <span className="min-w-0 truncate text-[14px] font-medium uppercase leading-5 tracking-[0.04em] text-nh-ink">
          {sortLabel}
        </span>
        <span className="flex size-7 items-center justify-center bg-white">
          <ChevronDown className="size-4 text-nh-ink" />
        </span>
      </button>
    </section>
  );
}
