"use client";

import { useState } from "react";
import { ChevronDown, Heart, Search, ShoppingCart, User } from "lucide-react";
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

  return (
    <header className="flex flex-col items-center gap-4 bg-white px-12 py-4">
      {/* Top subnav row */}
      <div className="flex w-full items-center justify-between gap-8">
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

      {/* Logo + main nav + utility */}
      <div className="flex w-full flex-col items-center gap-4">
        {/* Logo mark — centered wordmark placeholder */}
        <a
          className="font-freeman flex items-center justify-center text-[22px] font-semibold tracking-tight text-nh-ink"
          href="#"
          aria-label="nanoHome"
        >
          nanoHome
        </a>

        <div className="flex w-full items-center justify-between gap-8">
          {/* Main category nav */}
          <nav className="flex items-center gap-6" aria-label="Categories">
            {CATEGORIES.map((label) => (
              <span
                className="text-[14px] font-medium uppercase leading-5 text-nh-ink"
                key={label}
              >
                {label}
              </span>
            ))}
          </nav>

          {/* Utility icons + locale toggle */}
          <div className="flex items-center gap-5">
            <button
              className="text-nh-ink transition-opacity hover:opacity-70"
              type="button"
              aria-label="Tìm kiếm"
            >
              <Search className="size-5" />
            </button>
            <button
              className="text-nh-ink transition-opacity hover:opacity-70"
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
              className="text-nh-ink transition-opacity hover:opacity-70"
              type="button"
              aria-label="Tài khoản"
            >
              <User className="size-5" />
            </button>
            {/* VN | EN toggle */}
            <div className="flex items-center gap-1.5">
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
      </div>
    </header>
  );
}