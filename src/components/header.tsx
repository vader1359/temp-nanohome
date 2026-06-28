"use client";

import { ChevronDown, Heart, Search, ShoppingCart, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";

export function Header() {
  const t = useTranslations("Header");
  const locale = useLocale();
  const topLeft = ["brandFurniture", "brandLighting", "brandPreLove"] as const;
  const topRight = ["showrooms", "about", "news", "contact", "signIn"] as const;
  const nav = ["products", "livingRoom", "diningRoom", "bedroom", "workspace", "outdoor", "accessories", "bySet"] as const;

  return (
    <header className="relative z-30 h-[150px] bg-white px-6 py-4 lg:px-12">
      <div className="hidden items-center justify-between border-b border-[#cfc9c0] pb-4 lg:flex">
        <div className="flex gap-5">{topLeft.map((key) => <Link key={key} href="#" className="text-xs leading-[18px] text-[#666]">{t(key)}</Link>)}</div>
        <div className="flex gap-5">{topRight.map((key) => <Link key={key} href="#" className="flex items-center gap-1 text-xs leading-[18px] text-[#666]">{t(key)}{key === "showrooms" && <ChevronDown className="size-3" />}</Link>)}</div>
      </div>
      <div className="flex h-[83px] flex-col justify-end gap-4 lg:items-center">
        <Link href={`/${locale}`} className="self-center"><Image src="/images/nanohome-logo.svg" alt="nanoHome" width={154} height={32} priority /></Link>
        <div className="flex w-full items-center justify-between">
          <nav className="hidden items-center gap-6 lg:flex">{nav.map((key) => <Link key={key} href="#" className="whitespace-nowrap text-sm font-medium uppercase leading-5">{t(key)}</Link>)}</nav>
          <div className="ml-auto flex items-center gap-5">
            <button aria-label="Search"><Search className="size-5 stroke-[1.4]" /></button><button aria-label="Wishlist"><Heart className="size-5 stroke-[1.4]" /></button>
            <button aria-label="Cart" className="relative"><ShoppingCart className="size-5 stroke-[1.4]" /><span className="absolute -bottom-1 -left-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">1</span></button>
            <button aria-label="Account"><UserRound className="size-5 stroke-[1.4]" /></button>
            <div className="flex gap-1.5 text-xs"><span className={locale === "vi" ? "text-[#111]" : "text-[#999]"}>VN</span><span>|</span><span className={locale === "en" ? "text-[#111]" : "text-[#999]"}>EN</span></div>
          </div>
        </div>
      </div>
    </header>
  );
}
