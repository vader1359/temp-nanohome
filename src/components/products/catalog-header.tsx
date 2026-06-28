"use client";

import { useState } from "react";
import { ChevronDown, Heart, Menu, Search, ShoppingCart, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

const SUBNAV_LEFT = [
  "nanoHome Nội Thất",
  "nanoHome Chiếu Sáng",
  "nanoHome Pre - Love",
];

const SUBNAV_RIGHT = ["Về chúng tôi", "Tin tức", "Liên hệ", "Đăng nhập"];

const CATEGORIES = [
  "Sản phẩm",
  "Phòng khách",
  "Phòng Ăn",
  "Phòng Ngủ",
  "Không Gian Làm Việc",
  "Ngoài Trời",
  "Phụ kiện & trang trí",
  "Theo bộ",
];

export function CatalogHeader() {
  const [locale, setLocale] = useState<"VN" | "EN">("VN");
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="flex flex-col items-center gap-4 bg-white px-4 py-4 sm:px-6 lg:px-12">
      {/* Top subnav row — desktop only */}
      <div className="hidden w-full items-center justify-between gap-8 lg:flex">
        <nav className="flex items-center gap-5" aria-label="Sub navigation">
          {SUBNAV_LEFT.map((label) => (
            <span
              className="text-[12px] font-normal leading-[18px] text-nh-muted"
              key={label}
            >
              {label}
            </span>
          ))}
        </nav>
        <nav className="flex items-center gap-5" aria-label="Utility navigation">
          <span className="flex items-center gap-1">
            <span className="text-[12px] font-normal leading-[18px] text-nh-muted">
              Showrooms
            </span>
            <ChevronDown className="size-3 text-nh-icon-gray" />
          </span>
          {SUBNAV_RIGHT.map((label) => (
            <span
              className="text-[12px] font-normal leading-[18px] text-nh-muted"
              key={label}
            >
              {label}
            </span>
          ))}
        </nav>
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-nh-border" />

      {/* Logo + mobile hamburger + utility icons */}
      <div className="flex w-full items-center justify-between gap-4">
        {/* Mobile hamburger — left side */}
        <button
          type="button"
          aria-label={drawerOpen ? "Đóng menu" : "Mở menu"}
          className="flex size-8 shrink-0 items-center justify-center text-nh-ink lg:hidden"
          onClick={() => setDrawerOpen((prev) => !prev)}
        >
          {drawerOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>

        {/* Logo mark — centered */}
        <a
          className="font-freeman flex flex-1 items-center justify-center text-[22px] font-semibold tracking-tight text-nh-ink lg:flex-none"
          href="#"
          aria-label="nanoHome"
        >
          nanoHome
        </a>

        {/* Utility icons + locale toggle — right side */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <button
            className="hidden text-nh-ink transition-opacity hover:opacity-70 sm:block"
            type="button"
            aria-label="Tìm kiếm"
          >
            <Search className="size-5" />
          </button>
          <button
            className="hidden text-nh-ink transition-opacity hover:opacity-70 sm:block"
            type="button"
            aria-label="Yêu thích"
          >
            <Heart className="size-5" />
          </button>
          <div className="relative">
            <button
              className="text-nh-ink transition-opacity hover:opacity-70"
              type="button"
              aria-label="Giỏ hàng"
            >
              <ShoppingCart className="size-5" />
            </button>
            {/* Cart badge */}
            <span
              className="absolute -right-2 -top-2 flex size-[18px] items-center justify-center rounded-full border-[0.5px] border-white bg-nh-red text-[10px] font-normal leading-[16px] text-white"
              aria-label="Số lượng trong giỏ hàng"
            >
              1
            </span>
          </div>
          <button
            className="hidden text-nh-ink transition-opacity hover:opacity-70 sm:block"
            type="button"
            aria-label="Tài khoản"
          >
            <User className="size-5" />
          </button>
          {/* VN | EN toggle */}
          <div className="hidden items-center gap-1.5 sm:flex">
            <button
              className={cn(
                "text-[12px] font-normal leading-[18px] transition-opacity",
                locale === "VN"
                  ? "text-nh-ink"
                  : "text-nh-muted hover:text-nh-ink"
              )}
              onClick={() => setLocale("VN")}
              type="button"
            >
              VN
            </button>
            <span className="text-[12px] font-normal leading-[18px] text-nh-ink">
              |
            </span>
            <button
              className={cn(
                "text-[12px] font-normal leading-[18px] transition-opacity",
                locale === "EN"
                  ? "text-nh-ink"
                  : "text-nh-muted hover:text-nh-ink"
              )}
              onClick={() => setLocale("EN")}
              type="button"
            >
              EN
            </button>
          </div>
        </div>
      </div>

      {/* Desktop category nav row */}
      <nav className="hidden w-full items-center gap-6 lg:flex" aria-label="Categories">
        {CATEGORIES.map((label) => (
          <span
            className="text-[14px] font-medium uppercase leading-5 text-nh-ink"
            key={label}
          >
            {label}
          </span>
        ))}
      </nav>

      {/* Mobile drawer */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out lg:hidden ${drawerOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="border-t border-nh-border pt-4 pb-2">
          {/* Subnav — left */}
          <div className="flex items-center justify-between border-b border-nh-border pb-4 sm:hidden">
            <div className="flex items-center gap-5 text-nh-ink">
              <button type="button" aria-label="Tìm kiếm"><Search className="size-5" /></button>
              <button type="button" aria-label="Yêu thích"><Heart className="size-5" /></button>
              <button type="button" aria-label="Tài khoản"><User className="size-5" /></button>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] leading-[18px]">
              <button type="button" onClick={() => setLocale("VN")} className={locale === "VN" ? "text-nh-ink" : "text-nh-muted"}>VN</button>
              <span>|</span>
              <button type="button" onClick={() => setLocale("EN")} className={locale === "EN" ? "text-nh-ink" : "text-nh-muted"}>EN</button>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-nh-border py-4 sm:pt-0">
            {SUBNAV_LEFT.map((label) => (
              <span
                key={label}
                className="text-[13px] font-normal leading-[18px] text-nh-muted"
              >
                {label}
              </span>
            ))}
          </div>

          {/* Category nav */}
          <nav className="flex flex-col gap-3 border-b border-nh-border py-4" aria-label="Categories">
            {CATEGORIES.map((label) => (
              <span
                key={label}
                className="text-sm font-medium uppercase leading-5 text-nh-ink"
              >
                {label}
              </span>
            ))}
          </nav>

          {/* Subnav — right */}
          <div className="flex flex-col gap-3 pt-4">
            <span className="flex items-center gap-1 text-[13px] leading-[18px] text-nh-muted">
              Showrooms
              <ChevronDown className="size-3 text-nh-icon-gray" />
            </span>
            {SUBNAV_RIGHT.map((label) => (
              <span
                key={label}
                className="text-[13px] leading-[18px] text-nh-muted"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
