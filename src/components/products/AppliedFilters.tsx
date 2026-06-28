"use client";

import { useTranslations } from "next-intl";
import { Chip } from "@/components/shared";

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
        <Chip key={filter} variant="outline" onRemove={() => onRemove(filter)}>
          {filter}
        </Chip>
      ))}
    </section>
  );
}
