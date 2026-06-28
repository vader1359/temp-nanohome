"use client";

import { Check, ChevronRight } from "lucide-react";
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

interface FilterSidebarProps {
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
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
    <section className={cn("flex w-full flex-col gap-4 border-b border-nh-border pb-4", className)}>
      <button
        className="flex h-6 w-full items-center justify-between text-left text-[16px] font-normal leading-6 text-nh-muted"
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
  selectedCategory,
  setSelectedCategory,
  selectedClassify,
  toggleClassify,
  selectedRooms,
  toggleRoom,
}: FilterSidebarProps) {
  const t = useTranslations("Products");
  const classifyItems = [t("inStock"), t("onSale"), t("comingSoon")];

  return (
    <aside className="flex w-full flex-col gap-6 self-start overflow-y-auto pr-5 [scrollbar-color:#8c8a86_transparent] [scrollbar-width:thin] lg:h-[880px] lg:w-[212px] lg:shrink-0">
      <CardSection title={t("classify")}>
        <div className="flex flex-col gap-4">
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
                <span className="relative h-6 w-[42px] shrink-0 rounded-full bg-nh-ink">
                  <span className="absolute left-[21px] top-0.5 size-5 rounded-full bg-white transition-transform" />
                </span>
                <span className="text-[12px] font-medium leading-4 text-nh-ink">{item}</span>
              </button>
            );
          })}
        </div>
      </CardSection>

      <CardSection title={t("productCategories")}>
        <div className="flex flex-col gap-2">
          {CATEGORIES.map((category) => (
            <button
              className={cn(
                "flex h-6 w-full items-center bg-white text-left text-[12px] font-medium leading-4",
                selectedCategory === category ? "text-nh-accent" : "text-nh-muted"
              )}
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
            >
              {category === "Tất cả" ? t("all") : category}
            </button>
          ))}
        </div>
      </CardSection>

      <CardSection title={t("byRoom")}>
        <div className="flex flex-col gap-2">
          {ROOMS.map((room) => {
            const checked = selectedRooms.has(room);

            return (
              <button
                className="flex items-center gap-4 text-left"
                key={room}
                type="button"
                onClick={() => toggleRoom(room)}
              >
                <span className="flex size-4 items-center justify-center border border-nh-icon-gray bg-white">
                  {checked ? <Check className="size-2.5 text-nh-icon-gray" /> : null}
                </span>
                <span className="text-[12px] font-medium leading-4 text-nh-ink">{room}</span>
              </button>
            );
          })}
        </div>
      </CardSection>
    </aside>
  );
}
