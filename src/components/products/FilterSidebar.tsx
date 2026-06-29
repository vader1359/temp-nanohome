"use client";

import Image from "next/image";
import { Check, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Tất cả",
  "Bàn",
  "Ghế",
  "Ghế thư giãn",
  "Ghế Sofas",
  "Tủ kệ",
  "Đèn bàn",
  "Đèn sàn",
  "Đèn treo thả",
  "Đèn tường",
  "Trang trí",
  "Nội thất ngoài trời",
  "Nội thất USM",
  "Giường",
  "Quà tặng",
];

const ROOMS = ["Phòng khách", "Phòng ăn", "Phòng ngủ", "Không gian làm việc"];

const LOCAL_LOGOS: Record<string, string> = {
  Knoll: "/images/knoll_logo.png",
  Maxalto: "/images/maxalto_logo.png",
  USM: "/images/usm_logo.png",
  Vitra: "/images/vitra_logo.png",
};

interface FilterSidebarProps {
  appliedFilters?: string[];
  brands: readonly { id: string; logoUrl: string | null; name: string }[];
  onRemoveFilter?: (value: string) => void;
  variant?: "desktop" | "modal";
  selectedBrands: Set<string>;
  selectedCategories: Set<string>;
  toggleBrand: (value: string) => void;
  toggleCategory: (value: string) => void;
  selectedClassify: Set<string>;
  toggleClassify: (value: string) => void;
  selectedRooms: Set<string>;
  toggleRoom: (value: string) => void;
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
  brands,
  onRemoveFilter,
  variant = "desktop",
  selectedBrands,
  selectedCategories,
  toggleBrand,
  toggleCategory,
  selectedClassify,
  toggleClassify,
  selectedRooms,
  toggleRoom,
}: FilterSidebarProps) {
  const t = useTranslations("Products");
  const classifyItems = [t("inStock"), t("onSale"), t("comingSoon")];

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
          </div>
        </section>
      ) : null}

      <CardSection title={t("classify")}>
        <div className="flex flex-col gap-2">
          {classifyItems.map((item) => {
            const checked = selectedClassify.has(item);

            return (
              <button
                className="flex w-full items-center gap-4 text-left"
                aria-pressed={checked}
                key={item}
                type="button"
                onClick={() => toggleClassify(item)}
              >
                <span className="relative h-5 w-9 shrink-0 rounded-full bg-nh-ink">
                  <span className="absolute left-[18px] top-0.5 size-4 rounded-full bg-white transition-transform" />
                </span>
                <span className="text-[11px] font-medium uppercase leading-4 text-nh-ink">{item}</span>
              </button>
            );
          })}
        </div>
      </CardSection>

      <CardSection title={t("productCategories")}>
        <div className={cn("gap-1", variant === "modal" ? "grid grid-cols-2" : "flex flex-col")}>
          {CATEGORIES.map((category) => {
            const checked = category === "Tất cả" ? selectedCategories.size === 0 : selectedCategories.has(category);

            return (
              <button
                className={cn(
                  "flex min-h-[24px] w-full items-center bg-transparent text-left text-[11px] font-medium uppercase leading-4",
                  checked ? "text-nh-accent" : "text-nh-muted"
                )}
                aria-pressed={checked}
                key={category}
                type="button"
                onClick={() => toggleCategory(category)}
              >
                {category === "Tất cả" ? t("all") : category}
              </button>
            );
          })}
        </div>
      </CardSection>

      {variant === "modal" && brands.length > 0 ? (
        <CardSection title="Thương hiệu">
          <div className="flex flex-wrap gap-2">
            {brands.map((brand) => {
              const checked = selectedBrands.has(brand.name);
              const logoUrl = brand.logoUrl ?? LOCAL_LOGOS[brand.name];

              return (
                <button
                  className={cn(
                    "group flex h-8 w-fit min-w-[68px] items-center justify-center border border-nh-ink bg-transparent px-2 transition-colors hover:bg-nh-ink",
                    checked && "bg-nh-ink"
                  )}
                  aria-label={brand.name}
                  aria-pressed={checked}
                  key={brand.id}
                  type="button"
                  onClick={() => toggleBrand(brand.name)}
                >
                  {logoUrl ? (
                    <Image
                      alt={brand.name}
                      className={cn(
                        "h-3.5 w-auto max-w-[72px] object-contain grayscale contrast-200 brightness-0 transition-[filter] group-hover:brightness-0 group-hover:invert",
                        checked && "brightness-0 invert"
                      )}
                      height={14}
                      src={logoUrl}
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

      <CardSection title={t("byRoom")}>
        <div className="flex flex-col gap-1">
          {ROOMS.map((room) => {
            const checked = selectedRooms.has(room);

            return (
              <button
                className="inline-flex min-h-[24px] items-center gap-3 text-left"
                key={room}
                type="button"
                onClick={() => toggleRoom(room)}
              >
                <span className="flex size-5 items-center justify-center border border-nh-icon-gray bg-white">
                  {checked ? <Check className="size-2.5 text-nh-icon-gray" /> : null}
                </span>
                <span className="text-[11px] font-medium uppercase leading-4 text-nh-ink">{room}</span>
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
