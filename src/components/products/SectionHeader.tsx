"use client";

import { ArrowUpDown, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface SectionHeaderProps {
  appliedFilters: string[];
  onOpenFilters: () => void;
  onRemoveFilter: (value: string) => void;
  sortBy: string;
}

export function SectionHeader({ appliedFilters, onOpenFilters, onRemoveFilter, sortBy }: SectionHeaderProps) {
  const t = useTranslations("Products");
  const sortLabel = sortBy === "recommended" ? t("sortRecommended") : sortBy;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const updateHidden = () => setHidden(window.scrollY > 120);
    updateHidden();
    window.addEventListener("scroll", updateHidden, { passive: true });
    return () => window.removeEventListener("scroll", updateHidden);
  }, []);

  return (
    <section className={`sticky top-0 z-40 w-full overflow-hidden bg-white transition-all ${hidden ? "h-0 border-y-0" : "border-y border-nh-ink"}`}>
      <div className="site-shell flex flex-col items-start gap-2 py-1.5 sm:py-1">
        <div className={hidden ? "hidden" : "flex w-full items-center justify-between gap-3"}>
          <h1 className="text-left text-[16px] font-medium leading-6 text-nh-ink">
            {t("title")}
          </h1>
          <div className="flex items-center gap-1">
            <button
              aria-label={`${t("sortBy")} ${sortLabel}`}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center bg-white text-nh-ink"
              type="button"
            >
              <ArrowUpDown className="size-4" />
            </button>
            <button
              aria-label="Mở bộ lọc"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center bg-white text-nh-ink lg:hidden"
              onClick={onOpenFilters}
              type="button"
            >
              <SlidersHorizontal className="size-4" />
            </button>
          </div>
        </div>
        {!hidden && appliedFilters.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 py-1.5">
            <span className="text-[12px] font-normal leading-4 text-nh-muted">
              {t("appliedFilters")}
            </span>
            {appliedFilters.map((filter) => (
              <button
                className="flex items-center gap-1 border border-nh-border px-1.5 py-1 text-[12px] font-normal leading-4 text-nh-ink"
                key={filter}
                type="button"
                onClick={() => onRemoveFilter(filter)}
              >
                {filter}
                <X className="size-3 text-nh-ink" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
