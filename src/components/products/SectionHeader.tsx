"use client";

import { ArrowUpDown, Check, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useHeaderScroll } from "@/hooks/use-header-scroll";
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
  const [sortOpen, setSortOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { isCompact } = useHeaderScroll();

  const sortTabs = [
    { key: "priority", label: t("sortPriority") },
    { key: "price_asc", label: t("sortPriceAsc") },
    { key: "price_desc", label: t("sortPriceDesc") },
  ] as const;
  const sortLabel = sortTabs.find((tab) => tab.key === sortBy)?.label ?? t("sortPriority");

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
    <section
      className={cn(
        "sticky z-20 w-full border-y border-nh-ink bg-white transform-gpu transition-[top,opacity,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[top,opacity,transform] motion-reduce:transition-none",
        isCompact ? "lg:opacity-0 lg:pointer-events-none lg:-translate-y-4" : "opacity-100 translate-y-0"
      )}
      // On mobile the header has a fixed compact height. Using the same target
      // lets this sticky bar animate in lockstep instead of waiting for the
      // ResizeObserver height update after the header has already shrunk.
      style={{ top: isCompact ? "var(--compact-header-height, 48px)" : "var(--header-height, 80px)" }}
      aria-hidden={isCompact}
      inert={isCompact ? true : undefined}
    >
      <div
        className={cn(
          "site-shell flex flex-col items-start gap-2 transform-gpu transition-[padding,gap] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          isCompact ? "gap-0 py-0 sm:gap-0 sm:py-0" : "gap-2 py-1.5 sm:gap-2 sm:py-1",
        )}
      >
        <div className="flex w-full items-center justify-between gap-3 transition-[min-height] duration-200 ease-out motion-reduce:transition-none">
          <h1 className={cn(
            "text-left font-medium text-nh-ink transition-[font-size,line-height] duration-150 ease-out motion-reduce:transition-none",
            isCompact
              ? "text-[13px] leading-4 sm:text-[14px] sm:leading-5"
              : "text-[14px] leading-5 sm:text-[16px] sm:leading-6",
          )}>
            {t("title")}
          </h1>
          <div className="relative flex items-center gap-1">
            <button
              ref={buttonRef}
               aria-label={`${t("sortBy")} ${sortLabel}`}
               aria-controls="product-sort-menu"
               aria-expanded={sortOpen}
               className={cn(
                 "flex items-center gap-2 bg-white px-2 text-nh-ink transition-[height,min-height] duration-200 ease-out motion-reduce:transition-none",
                 isCompact ? "h-8 min-h-8" : "h-11 min-h-11",
               )}
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
              className={cn(
                "flex items-center justify-center bg-white text-nh-ink transition-[height,min-height,min-width] duration-200 ease-out motion-reduce:transition-none lg:hidden",
                isCompact ? "h-8 min-h-8 min-w-8" : "h-11 min-h-11 min-w-11",
              )}
              onClick={onOpenFilters}
              type="button"
            >
              <SlidersHorizontal className="size-4" />
            </button>
          </div>
        </div>
        {!isCompact && appliedFilters.length > 0 ? (
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
