"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Heart, Menu, Search, ShoppingCart, UserRound, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";

export function Header() {
  const t = useTranslations("Header");
  const locale = useLocale();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const topLeft = ["brandFurniture", "brandLighting", "brandPreLove"] as const;
  const topRight = ["showrooms", "about", "news", "contact", "signIn"] as const;
  const nav = ["products", "livingRoom", "diningRoom", "bedroom", "workspace", "outdoor", "accessories", "bySet"] as const;

  useEffect(() => {
    function handleScroll() {
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollY.current;

      setHidden(scrollingDown && currentScrollY > 120 && !drawerOpen);
      lastScrollY.current = currentScrollY;
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [drawerOpen]);

  return (
    <header className={`sticky top-0 z-50 min-h-[80px] bg-white py-4 transition-transform duration-300 xl:h-[150px] ${hidden ? "-translate-y-full" : "translate-y-0"}`}>
      <div className="site-shell">
      {/* Top bar — desktop only */}
      <div className="hidden items-center justify-between border-b border-[#cfc9c0] pb-4 xl:flex">
        <div className="flex gap-5">{topLeft.map((key) => <Link key={key} href="#" className="text-xs leading-[18px] text-[#666]">{t(key)}</Link>)}</div>
        <div className="flex gap-5">{topRight.map((key) => <Link key={key} href="#" className="flex items-center gap-1 text-xs leading-[18px] text-[#666]">{t(key)}{key === "showrooms" && <ChevronDown className="size-3" />}</Link>)}</div>
      </div>

      {/* Mobile bar: hamburger + centered logo + cart */}
      <div className="flex items-center justify-between gap-0 pt-2 xl:h-[83px] xl:pt-0">
        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label={drawerOpen ? "Close menu" : "Open menu"}
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-[#111] xl:hidden"
          onClick={() => setDrawerOpen((prev) => !prev)}
        >
          {drawerOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>

        {/* Logo — centered on mobile, static on desktop */}
        <Link href={`/${locale}`} className="absolute left-1/2 shrink-0 -translate-x-1/2 xl:static xl:left-auto xl:translate-x-0">
          <Image src="/images/nanohome-logo.svg" alt="nanoHome" width={154} height={32} priority className="h-auto w-[100px] xl:w-auto" />
        </Link>

        {/* Mobile-only cart — always visible */}
        <button aria-label="Cart" className="relative flex min-h-[44px] min-w-[44px] items-center justify-center xl:hidden">
          <ShoppingCart className="size-5 stroke-[1.4]" />
          <span className="absolute -bottom-1 -left-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">1</span>
        </button>

        {/* Desktop category nav */}
        <nav className="hidden min-w-0 flex-1 items-center justify-start gap-4 xl:flex">{nav.map((key) => <Link key={key} href="#" className="whitespace-nowrap text-xs font-normal uppercase leading-4">{t(key)}</Link>)}</nav>

        {/* Desktop full icons row */}
        <div className="ml-auto hidden shrink-0 xl:flex xl:items-center xl:gap-2">
          <button aria-label="Search" className="flex h-8 w-8 items-center justify-center"><Search className="size-4 stroke-[1.3]" /></button>
          <button aria-label="Wishlist" className="flex h-8 w-8 items-center justify-center"><Heart className="size-4 stroke-[1.3]" /></button>
          <button aria-label="Cart" className="relative flex h-8 w-8 items-center justify-center"><ShoppingCart className="size-4 stroke-[1.3]" /><span className="absolute bottom-0 left-0 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">1</span></button>
          <button aria-label="Account" className="flex h-8 w-8 items-center justify-center"><UserRound className="size-4 stroke-[1.3]" /></button>
          <div className="flex gap-1 text-[11px] leading-4"><span className={locale === "vi" ? "text-[#111]" : "text-[#999]"}>VN</span><span>|</span><span className={locale === "en" ? "text-[#111]" : "text-[#999]"}>EN</span><span>|</span><span className="text-[#999]">KO</span></div>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out xl:hidden ${drawerOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="border-t border-[#cfc9c0] pt-4 pb-2">
          {/* Icon bar + locale */}
          <div className="flex items-center justify-between border-b border-[#cfc9c0] pb-4">
            <div className="flex items-center gap-5 text-[#111]">
              <button aria-label="Search" className="flex min-h-[44px] min-w-[44px] items-center justify-center"><Search className="size-5 stroke-[1.4]" /></button>
              <button aria-label="Wishlist" className="flex min-h-[44px] min-w-[44px] items-center justify-center"><Heart className="size-5 stroke-[1.4]" /></button>
              <button aria-label="Account" className="flex min-h-[44px] min-w-[44px] items-center justify-center"><UserRound className="size-5 stroke-[1.4]" /></button>
            </div>
            <div className="flex gap-1.5 text-xs"><span className={locale === "vi" ? "text-[#111]" : "text-[#999]"}>VN</span><span>|</span><span className={locale === "en" ? "text-[#111]" : "text-[#999]"}>EN</span></div>
          </div>
          {/* Category nav */}
          <nav className="flex flex-col gap-3 border-b border-[#cfc9c0] py-4">
            {nav.map((key) => (
              <Link
                key={key}
                href="#"
                onClick={() => setDrawerOpen(false)}
                className="text-sm font-medium uppercase leading-5 text-[#111]"
              >
                {t(key)}
              </Link>
            ))}
          </nav>
          {/* Top links */}
          <div className="flex flex-col gap-3 pt-4">
            {topLeft.map((key) => (
              <Link key={key} href="#" onClick={() => setDrawerOpen(false)} className="text-sm leading-[18px] text-[#666]">{t(key)}</Link>
            ))}
            {topRight.map((key) => (
              <Link key={key} href="#" onClick={() => setDrawerOpen(false)} className="flex items-center gap-1 text-sm leading-[18px] text-[#666]">{t(key)}{key === "showrooms" && <ChevronDown className="size-3" />}</Link>
            ))}
          </div>
        </div>
      </div>
      </div>
    </header>
  );
}
