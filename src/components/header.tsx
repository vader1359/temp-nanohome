"use client";

import { useState } from "react";
import {
  ChevronDown,
  Heart,
  Menu,
  Search,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";

export function Header() {
  const t = useTranslations("Header");
  const locale = useLocale();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const topLeft = ["brandFurniture", "brandLighting", "brandPreLove"] as const;
  const topRight = ["showrooms", "about", "news", "contact", "signIn"] as const;
  const nav = [
    "products",
    "livingRoom",
    "diningRoom",
    "bedroom",
    "workspace",
    "outdoor",
    "accessories",
    "bySet",
  ] as const;

  return (
    <header className="relative z-30 min-h-[80px] bg-white lg:h-[150px]">
      <div className="site-shell py-4">
        {/* Top bar — desktop only */}
        <div className="hidden items-center justify-between border-b border-[#cfc9c0] pb-4 lg:flex">
          <div className="flex gap-5">
            {topLeft.map((key) => (
              <Link
                key={key}
                href="#"
                className="text-xs leading-[18px] text-[#666]"
              >
                {t(key)}
              </Link>
            ))}
          </div>
          <div className="flex gap-5">
            {topRight.map((key) => (
              <Link
                key={key}
                href="#"
                className="flex items-center gap-1 text-xs leading-[18px] text-[#666]"
              >
                {t(key)}
                {key === "showrooms" && <ChevronDown className="size-3" />}
              </Link>
            ))}
          </div>
        </div>

        {/* Mobile bar: hamburger + centered logo + cart */}
        <div className="flex items-center justify-between gap-4 pt-2 lg:h-[83px] lg:gap-0 lg:pt-0">
          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            className="flex size-8 shrink-0 items-center justify-center text-[#111] lg:hidden"
            onClick={() => setDrawerOpen((prev) => !prev)}
          >
            {drawerOpen ? (
              <X className="size-6" />
            ) : (
              <Menu className="size-6" />
            )}
          </button>

          {/* Logo — centered on mobile, static on desktop */}
          <Link
            href={`/${locale}`}
            className="absolute left-1/2 -translate-x-1/2 lg:static lg:left-auto lg:translate-x-0"
          >
            <Image
              src="/images/nanohome-logo.svg"
              alt="nanoHome"
              width={154}
              height={32}
              priority
              className="h-auto w-[100px] lg:w-auto"
            />
          </Link>

          {/* Mobile-only cart — always visible */}
          <button
            aria-label="Cart"
            className="relative flex items-center lg:hidden"
          >
            <ShoppingCart className="size-5 stroke-[1.4]" />
            <span className="absolute -bottom-1 -left-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">
              1
            </span>
          </button>

          {/* Desktop category nav */}
          <nav className="hidden items-center gap-6 lg:flex">
            {nav.map((key) => (
              <Link
                key={key}
                href="#"
                className="whitespace-nowrap text-sm font-normal uppercase leading-5"
              >
                {t(key)}
              </Link>
            ))}
          </nav>

          {/* Desktop full icons row */}
          <div className="hidden lg:flex lg:items-center lg:gap-5 lg:ml-auto">
            <button aria-label="Search">
              <Search className="size-5 stroke-[1.4]" />
            </button>
            <button aria-label="Wishlist">
              <Heart className="size-5 stroke-[1.4]" />
            </button>
            <button aria-label="Cart" className="relative">
              <ShoppingCart className="size-5 stroke-[1.4]" />
              <span className="absolute -bottom-1 -left-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">
                1
              </span>
            </button>
            <button aria-label="Account">
              <UserRound className="size-5 stroke-[1.4]" />
            </button>
            <div className="flex gap-1.5 text-xs">
              <span className={locale === "vi" ? "text-[#111]" : "text-[#999]"}>
                VN
              </span>
              <span>|</span>
              <span className={locale === "en" ? "text-[#111]" : "text-[#999]"}>
                EN
              </span>
              <span>|</span>
              <span className={locale === "ko" ? "text-[#111]" : "text-[#999]"}>
                KO
              </span>
            </div>
          </div>
        </div>

        {/* Mobile drawer */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out lg:hidden ${drawerOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="border-t border-[#cfc9c0] pt-4 pb-2">
            {/* Icon bar + locale */}
            <div className="flex items-center justify-between border-b border-[#cfc9c0] pb-4">
              <div className="flex items-center gap-5 text-[#111]">
                <button aria-label="Search">
                  <Search className="size-5 stroke-[1.4]" />
                </button>
                <button aria-label="Wishlist">
                  <Heart className="size-5 stroke-[1.4]" />
                </button>
                <button aria-label="Account">
                  <UserRound className="size-5 stroke-[1.4]" />
                </button>
              </div>
              <div className="flex gap-1.5 text-xs">
                <span
                  className={locale === "vi" ? "text-[#111]" : "text-[#999]"}
                >
                  VN
                </span>
                <span>|</span>
                <span
                  className={locale === "en" ? "text-[#111]" : "text-[#999]"}
                >
                  EN
                </span>
                <span>|</span>
                <span
                  className={locale === "ko" ? "text-[#111]" : "text-[#999]"}
                >
                  KO
                </span>
              </div>
            </div>
            {/* Category nav */}
            <nav className="flex flex-col gap-3 border-b border-[#cfc9c0] py-4">
              {nav.map((key) => (
                <Link
                  key={key}
                  href="#"
                  onClick={() => setDrawerOpen(false)}
                  className="text-sm font-normal uppercase leading-5 text-[#111]"
                >
                  {t(key)}
                </Link>
              ))}
            </nav>
            {/* Top links */}
            <div className="flex flex-col gap-3 pt-4">
              {topLeft.map((key) => (
                <Link
                  key={key}
                  href="#"
                  onClick={() => setDrawerOpen(false)}
                  className="text-sm leading-[18px] text-[#666]"
                >
                  {t(key)}
                </Link>
              ))}
              {topRight.map((key) => (
                <Link
                  key={key}
                  href="#"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-1 text-sm leading-[18px] text-[#666]"
                >
                  {t(key)}
                  {key === "showrooms" && <ChevronDown className="size-3" />}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
