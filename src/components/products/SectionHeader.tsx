"use client";

import { ArrowUpDown, Check, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ProductSort } from "@/lib/queries/products";

interface SectionHeaderProps {
  appliedFilters: readonly string[];
  onOpenFilters: () => void;
  onRemoveFilter: (value: string) => void;
  onResetFilters: () => void;
  onSortChange: (sort: ProductSort) => void;
  sortBy: ProductSort;
}

export function SectionHeader({ appliedFilters, onOpenFilters, onRemoveFilter, onResetFilters, onSortChange, sortBy }: SectionHeaderProps) {
  const t = useTranslations("Products");
  const [hidden, setHidden] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const sortTabs = [
    { key: "priority", label: t("sortPriority") },
    { key: "price_asc", label: t("sortPriceAsc") },
    { key: "price_desc", label: t("sortPriceDesc") },
  ] as const;
  const sortLabel = sortTabs.find((tab) => tab.key === sortBy)?.label ?? t("sortPriority");

  useEffect(() => {
    const updateHidden = () => setHidden(window.scrollY > 120);
    updateHidden();
    window.addEventListener("scroll", updateHidden, { passive: true });
    return () => window.removeEventListener("scroll", updateHidden);
  }, []);

  useEffect(() => {
    if (!sortOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setSortOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSortOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [sortOpen]);

  return (
    <section className={`sticky top-0 z-20 w-full bg-white transition-all ${hidden ? "h-0 border-y-0 overflow-hidden" : "border-y border-nh-ink"}`}>
      <div className="site-shell flex flex-col items-start gap-2 py-1.5 sm:py-1">
        <div className={hidden ? "hidden" : "flex w-full items-center justify-between gap-3"}>
          <h1 className="text-left text-[16px] font-medium leading-6 text-nh-ink">
            {t("title")}
          </h1>
          <div className="relative flex items-center gap-1">
            <button
              ref={buttonRef}
               aria-label={`${t("sortBy")} ${sortLabel}`}
               aria-controls="product-sort-menu"
               aria-expanded={sortOpen}
               className="flex min-h-[44px] items-center gap-2 bg-white px-2 text-nh-ink"
              type="button"
              onClick={() => setSortOpen((value) => !value)}
            >
              <ArrowUpDown className="size-4" />
              <span className="hidden text-xs uppercase sm:inline">
                <span className="font-normal normal-case text-nh-muted">{t("sortBy")} </span>
                <span className="font-medium text-nh-ink">{sortLabel}</span>
              </span>
            </button>
            {sortOpen ? (
              <div
                ref={dropdownRef}
                id="product-sort-menu"
                role="menu"
                className="absolute right-0 top-full z-30 mt-1 w-[240px] max-w-[80vw] border border-nh-border bg-white p-1 shadow-lg"
              >
                <div className="flex flex-col py-1">
                  {sortTabs.map((tab) => {
                    const active = sortBy === tab.key;
                    return (
                      <button
                         key={tab.key}
                         role="menuitemradio"
                         aria-checked={active}
                         onClick={() => {
                          onSortChange(tab.key as ProductSort);
                          setSortOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-50",
                          active ? "font-medium text-nh-ink" : "text-neutral-600",
                        )}
                        type="button"
                      >
                        <span>{tab.label}</span>
                        {active && <Check className="size-4 text-nh-ink" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <button
               aria-label={t("filterDialogLabel")}
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
            <button
              className="px-1.5 py-1 text-[12px] font-medium leading-4 text-nh-red underline-offset-2 hover:underline"
              type="button"
              onClick={onResetFilters}
            >
               {t("clearAll")}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
