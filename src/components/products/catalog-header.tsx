"use client";

import { useState } from "react";
import {
  ChevronDown,
  Heart,
  Menu,
  Search,
  ShoppingCart,
  User,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type HeaderKey =
  | "brandFurniture"
  | "brandLighting"
  | "brandPreLove"
  | "showrooms"
  | "about"
  | "news"
  | "contact"
  | "signIn"
  | "products"
  | "livingRoom"
  | "diningRoom"
  | "bedroom"
  | "workspace"
  | "outdoor"
  | "accessories"
  | "bySet";

const SUBNAV_LEFT_KEYS: readonly HeaderKey[] = [
  "brandFurniture",
  "brandLighting",
  "brandPreLove",
];

const SUBNAV_RIGHT_KEYS: readonly HeaderKey[] = [
  "about",
  "news",
  "contact",
  "signIn",
];

const CATEGORY_KEYS: readonly HeaderKey[] = [
  "products",
  "livingRoom",
  "diningRoom",
  "bedroom",
  "workspace",
  "outdoor",
  "accessories",
  "bySet",
];

export function CatalogHeader() {
  const t = useTranslations("Header");
  const locale = useLocale();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="bg-white py-4">
      <div className="site-shell flex flex-col items-center gap-4">
        {/* Top subnav row — desktop only */}
        <div className="hidden w-full items-center justify-between gap-8 lg:flex">
          <nav className="flex items-center gap-5" aria-label="Sub navigation">
            {SUBNAV_LEFT_KEYS.map((key) => (
              <span
                className="text-[12px] font-normal leading-[18px] text-nh-muted"
                key={key}
              >
                {t(key)}
              </span>
            ))}
          </nav>
          <nav
            className="flex items-center gap-5"
            aria-label="Utility navigation"
          >
            <span className="flex items-center gap-1">
              <span className="text-[12px] font-normal leading-[18px] text-nh-muted">
                {t("showrooms")}
              </span>
              <ChevronDown className="size-3 text-nh-icon-gray" />
            </span>
            {SUBNAV_RIGHT_KEYS.map((key) => (
              <span
                className="text-[12px] font-normal leading-[18px] text-nh-muted"
                key={key}
              >
                {t(key)}
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
            aria-label={drawerOpen ? t("closeMenu") : t("openMenu")}
            className="flex size-8 shrink-0 items-center justify-center text-nh-ink lg:hidden"
            onClick={() => setDrawerOpen((prev) => !prev)}
          >
            {drawerOpen ? (
              <X className="size-6" />
            ) : (
              <Menu className="size-6" />
            )}
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
              aria-label={t("search")}
            >
              <Search className="size-5" />
            </button>
            <button
              className="hidden text-nh-ink transition-opacity hover:opacity-70 sm:block"
              type="button"
              aria-label={t("wishlist")}
            >
              <Heart className="size-5" />
            </button>
            <div className="relative">
              <button
                className="text-nh-ink transition-opacity hover:opacity-70"
                type="button"
                aria-label={t("cart")}
              >
                <ShoppingCart className="size-5" />
              </button>
              {/* Cart badge */}
              <span
                className="absolute -right-2 -top-2 flex size-[18px] items-center justify-center rounded-full border-[0.5px] border-white bg-nh-red text-[10px] font-normal leading-[16px] text-white"
                aria-label={t("cartItemsCount")}
              >
                1
              </span>
            </div>
            <button
              className="hidden text-nh-ink transition-opacity hover:opacity-70 sm:block"
              type="button"
              aria-label={t("account")}
            >
              <User className="size-5" />
            </button>
            {/* VN | EN | KO toggle */}
            <div className="hidden items-center gap-1.5 sm:flex">
              <span
                className={cn(
                  "text-[12px] font-normal leading-[18px] transition-opacity",
                  locale === "vi"
                    ? "text-nh-ink"
                    : "text-nh-muted hover:text-nh-ink",
                )}
              >
                VN
              </span>
              <span className="text-[12px] font-normal leading-[18px] text-nh-ink">
                |
              </span>
              <span
                className={cn(
                  "text-[12px] font-normal leading-[18px] transition-opacity",
                  locale === "en"
                    ? "text-nh-ink"
                    : "text-nh-muted hover:text-nh-ink",
                )}
              >
                EN
              </span>
              <span className="text-[12px] font-normal leading-[18px] text-nh-ink">
                |
              </span>
              <span
                className={cn(
                  "text-[12px] font-normal leading-[18px] transition-opacity",
                  locale === "ko"
                    ? "text-nh-ink"
                    : "text-nh-muted hover:text-nh-ink",
                )}
              >
                KO
              </span>
            </div>
          </div>
        </div>

        {/* Desktop category nav row */}
        <nav
          className="hidden w-full items-center gap-6 lg:flex"
          aria-label="Categories"
        >
          {CATEGORY_KEYS.map((key) => (
            <span
              className="text-[14px] font-normal uppercase leading-5 text-nh-ink"
              key={key}
            >
              {t(key)}
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
                <button type="button" aria-label={t("search")}>
                  <Search className="size-5" />
                </button>
                <button type="button" aria-label={t("wishlist")}>
                  <Heart className="size-5" />
                </button>
                <button type="button" aria-label={t("account")}>
                  <User className="size-5" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-[12px] leading-[18px]">
                <span
                  className={locale === "vi" ? "text-nh-ink" : "text-nh-muted"}
                >
                  VN
                </span>
                <span>|</span>
                <span
                  className={locale === "en" ? "text-nh-ink" : "text-nh-muted"}
                >
                  EN
                </span>
                <span>|</span>
                <span
                  className={locale === "ko" ? "text-nh-ink" : "text-nh-muted"}
                >
                  KO
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-b border-nh-border py-4 sm:pt-0">
              {SUBNAV_LEFT_KEYS.map((key) => (
                <span
                  key={key}
                  className="text-[13px] font-normal leading-[18px] text-nh-muted"
                >
                  {t(key)}
                </span>
              ))}
            </div>

            {/* Category nav */}
            <nav
              className="flex flex-col gap-3 border-b border-nh-border py-4"
              aria-label="Categories"
            >
              {CATEGORY_KEYS.map((key) => (
                <span
                  key={key}
                  className="text-sm font-normal uppercase leading-5 text-nh-ink"
                >
                  {t(key)}
                </span>
              ))}
            </nav>

            {/* Subnav — right */}
            <div className="flex flex-col gap-3 pt-4">
              <span className="flex items-center gap-1 text-[13px] leading-[18px] text-nh-muted">
                {t("showrooms")}
                <ChevronDown className="size-3 text-nh-icon-gray" />
              </span>
              {SUBNAV_RIGHT_KEYS.map((key) => (
                <span
                  key={key}
                  className="text-[13px] leading-[18px] text-nh-muted"
                >
                  {t(key)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
