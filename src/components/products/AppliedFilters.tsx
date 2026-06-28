"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";

interface AppliedFiltersProps {
  appliedFilters: string[];
  onRemove: (value: string) => void;
}

export function AppliedFilters({ appliedFilters, onRemove }: AppliedFiltersProps) {
  const t = useTranslations("Products");

  return (
    <section className="flex flex-wrap items-center gap-[19px]">
      <span className="text-[14px] font-normal leading-5 text-nh-muted">
        {t("appliedFilters")}
      </span>
      {appliedFilters.map((filter) => (
        <button
          className="flex items-center gap-1 border border-nh-border px-1 py-1.5 text-[14px] font-normal leading-5 text-nh-ink"
          key={filter}
          type="button"
          onClick={() => onRemove(filter)}
        >
          {filter}
          <X className="size-3.5 text-nh-ink" />
        </button>
      ))}
    </section>
  );
}
