"use client";

import Image from "next/image";
import { Check, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { BrandOption, CategoryOption, RoomOption, SelectedProductFilters } from "./products-page";

interface FilterSidebarProps {
  appliedFilters?: readonly string[];
  brandOptions: readonly BrandOption[];
  categoryOptions: readonly CategoryOption[];
  onRemoveFilter?: (value: string) => void;
  onResetFilters?: () => void;
  roomOptions: readonly RoomOption[];
  selectedBrands: Set<string>;
  selectedCategories: Set<string>;
  selectedRooms: Set<string>;
  selectedStatus: SelectedProductFilters["status"];
  selectedSubCategories: Set<string>;
  toggleBrand: (value: string) => void;
  toggleCategory: (value: string) => void;
  toggleRoom: (value: string) => void;
  toggleStatus: (value: NonNullable<SelectedProductFilters["status"]>) => void;
  toggleSubCategory: (value: string) => void;
  variant?: "desktop" | "modal";
}

function CardSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className={cn("flex w-full flex-col gap-4 border-b border-nh-border pb-3", className)}>
      <button
        className="flex min-h-[44px] w-full items-center justify-between text-left text-[16px] font-normal uppercase leading-6 text-nh-muted"
        aria-expanded={open}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span>
        <span className="flex size-6 shrink-0 items-center justify-center">
          <ChevronRight className={cn("size-3 text-nh-ink transition-transform", open && "rotate-90")} strokeWidth={2} />
        </span>
      </button>
      {open ? children : null}
    </section>
  );
}

export function FilterSidebar({
  appliedFilters = [],
  brandOptions,
  categoryOptions,
  onRemoveFilter,
  onResetFilters,
  roomOptions,
  selectedBrands,
  selectedCategories,
  selectedRooms,
  selectedStatus,
  selectedSubCategories,
  toggleBrand,
  toggleCategory,
  toggleRoom,
  toggleStatus,
  toggleSubCategory,
  variant = "desktop",
}: FilterSidebarProps) {
  const t = useTranslations("Products");
  const classifyItems = [
    { label: t("classifyInStock"), value: "in_stock" as const },
    { label: t("classifyOnSale"), value: "sale" as const },
  ];

  return (
    <aside className={cn(
      "w-full flex-col gap-4 self-start",
      variant === "desktop" ? "hidden lg:flex lg:w-[212px] lg:shrink-0" : "flex",
    )}>
      <div>
        <div className="flex w-full flex-col gap-4 overflow-y-auto pr-5 [scrollbar-color:#8c8a86_transparent] [scrollbar-width:thin] lg:h-[880px]">
          {variant === "modal" && appliedFilters.length > 0 && onRemoveFilter ? (
            <section className="flex flex-col gap-3 border-b border-nh-border pb-4">
              <span className="text-[12px] font-normal leading-4 text-nh-muted">{t("appliedFilters")}</span>
              <div className="flex flex-wrap gap-2">
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
                {onResetFilters ? (
                  <button
                    className="px-1.5 py-1 text-[12px] font-medium leading-4 text-nh-red underline-offset-2 hover:underline"
                    type="button"
                    onClick={onResetFilters}
                  >
                    Xóa tất cả
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          <CardSection title={t("classify")}>
            <div className="flex flex-col gap-2">
              {classifyItems.map((item) => {
                const checked = selectedStatus === item.value;

                return (
                  <button
                    className="flex w-full items-center gap-4 text-left"
                    aria-pressed={checked}
                    key={item.value}
                    type="button"
                    onClick={() => toggleStatus(item.value)}
                  >
                    <span className={cn("relative h-5 w-9 shrink-0 rounded-full", checked ? "bg-nh-ink" : "bg-nh-border")}>
                      <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-transform", checked ? "left-[18px]" : "left-0.5")} />
                    </span>
                    <span className="text-[11px] font-medium uppercase leading-4 text-nh-ink">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </CardSection>

          <CardSection title={t("productCategories")}>
            <div className={cn("gap-1", variant === "modal" ? "grid grid-cols-2" : "flex flex-col")}>
              {categoryOptions.map((category) => {
                const checked = selectedCategories.has(category.slug);
                return (
                  <button
                    className={cn(
                      "flex min-h-[24px] w-full items-center bg-transparent text-left text-[11px] font-medium uppercase leading-4",
                      checked ? "text-nh-accent" : "text-nh-muted"
                    )}
                    aria-pressed={checked}
                    key={category.slug}
                    type="button"
                    onClick={() => toggleCategory(category.slug)}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </CardSection>

          {categoryOptions.flatMap((category) => category.subCategories).length > 0 ? (
            <CardSection title={t("subCategory")}>
              <div className={cn("gap-1", variant === "modal" ? "grid grid-cols-2" : "flex flex-col")}>
                {categoryOptions.flatMap((category) => category.subCategories).map((subCategory) => {
                  const checked = selectedSubCategories.has(subCategory.slug);
                  return (
                    <button
                      className={cn(
                        "flex min-h-[24px] w-full items-center bg-transparent text-left text-[11px] font-medium uppercase leading-4",
                        checked ? "text-nh-accent" : "text-nh-muted"
                      )}
                      aria-pressed={checked}
                      key={subCategory.slug}
                      type="button"
                      onClick={() => toggleSubCategory(subCategory.slug)}
                    >
                      {subCategory.name}
                    </button>
                  );
                })}
              </div>
            </CardSection>
          ) : null}

          {variant === "modal" && brandOptions.length > 0 ? (
            <CardSection title="Thương hiệu">
              <div className="flex flex-wrap gap-2">
                {brandOptions.map((brand) => {
                  const checked = selectedBrands.has(brand.slug);
                  return (
                    <button
                      className={cn(
                        "group flex h-8 w-fit min-w-[68px] items-center justify-center border border-nh-ink bg-transparent px-2 transition-colors hover:bg-nh-ink",
                        checked && "bg-nh-ink"
                      )}
                      aria-label={brand.name}
                      aria-pressed={checked}
                      data-testid={`brand-filter-${brand.slug}`}
                      key={brand.id}
                      type="button"
                      onClick={() => toggleBrand(brand.slug)}
                    >
                      {brand.logoUrl ? (
                        <Image
                          alt={brand.name}
                          className={cn(
                            "h-3.5 w-auto max-w-[72px] object-contain grayscale contrast-200 brightness-0 transition-[filter] group-hover:brightness-0 group-hover:invert",
                            checked && "brightness-0 invert"
                          )}
                          height={14}
                          src={brand.logoUrl}
                          style={{ width: "auto" }}
                          width={120}
                        />
                      ) : (
                        <span className={cn("text-[10px] font-medium uppercase leading-3 text-nh-ink transition-colors group-hover:text-white", checked && "text-white")}>{brand.name}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardSection>
          ) : null}

          <CardSection title={t("roomsHeading")}>
            <div className="flex flex-col gap-1">
              {roomOptions.map((room) => {
                const checked = selectedRooms.has(room.slug);
                return (
                  <button
                    className="inline-flex min-h-[24px] items-center gap-3 text-left"
                    key={room.slug}
                    type="button"
                    onClick={() => toggleRoom(room.slug)}
                  >
                    <span className="flex size-5 items-center justify-center border border-nh-icon-gray bg-white">
                      {checked ? <Check className="size-2.5 text-nh-icon-gray" /> : null}
                    </span>
                    <span className="text-[11px] font-medium uppercase leading-4 text-nh-ink">{room.label}</span>
                  </button>
                );
              })}
            </div>
          </CardSection>
        </div>
      </div>
    </aside>
  );
}
