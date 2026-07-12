"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ChevronDown,
  Heart,
  LogOut,
  Menu,
  Search,
  ShoppingCart,
  User,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart/cart-context";
import { useWishlist } from "@/components/wishlist/wishlist-context";
import { useAuthContext } from "@/components/auth/auth-provider";
import type { CartSidebarTab } from "./cart-sidebar";

const CartSidebar = dynamic(
  () => import("./cart-sidebar").then((module) => module.CartSidebar),
  { ssr: false },
);

export function Header() {
  const t = useTranslations("Header");
  const locale = useLocale();
  const pathname = usePathname();
  const currentQuery = useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => "",
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartTab, setCartTab] = useState<CartSidebarTab>("cart");
  const { items, addItem, clearCart, getItemCount, removeItem, updateQuantity } = useCart();
  const { items: wishlistItems, clearWishlist, getItemCount: getWishlistCount, removeItem: removeWishlistItem } = useWishlist();
  const { isAuthenticated, openAuth } = useAuthContext();
  const cartCount = getItemCount();
  const wishlistCount = getWishlistCount();
  const topLeft = ["brandFurniture", "brandLighting"] as const;
  const topRight = ["showrooms", "about", "news", "contact"] as const;
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
  const productsPath = `/${locale}/products`;
  const searchPath = `/${locale}/search`;
  const localeOptions = [
    { code: "vi", label: "VN" },
    { code: "en", label: "EN" },
    { code: "ko", label: "KO" },
  ] as const;

  const localeHref = (nextLocale: (typeof localeOptions)[number]["code"]) => {
    const segments = pathname.split("/");
    if (segments[1] === "vi" || segments[1] === "en" || segments[1] === "ko") {
      segments[1] = nextLocale;
    } else {
      segments.splice(1, 0, nextLocale);
    }

    return `${segments.join("/") || `/${nextLocale}`}${currentQuery}`;
  };

  const localeSwitcher = (
    <div className="flex gap-1.5 text-xs">
      {localeOptions.map(({ code, label }, index) => (
        <span key={code} className="contents">
          {index > 0 ? <span>|</span> : null}
          <Link
            href={localeHref(code)}
            className={locale === code ? "text-[#111]" : "text-[#999] hover:text-[#111]"}
            hrefLang={code}
          >
            {label}
          </Link>
        </span>
      ))}
    </div>
  );

  const topLeftHref = (key: (typeof topLeft)[number]): string => {
    switch (key) {
      case "brandFurniture":
        return `/${locale}`;
      case "brandLighting":
        return `${productsPath}?category=lighting`;
    }
  };

  const topRightHref = (key: (typeof topRight)[number]): string => {
    switch (key) {
      case "about":
        return `/${locale}/about-us`;
      case "news":
        return `/${locale}/news`;
      case "showrooms":
      case "contact":
        return `/${locale}/about-us`;
    }
  };

  const navHref = (key: (typeof nav)[number]): string => {
    switch (key) {
      case "products":
        return productsPath;
      case "livingRoom":
        return `${productsPath}?room=living-room`;
      case "diningRoom":
        return `${productsPath}?room=dining-room`;
      case "bedroom":
        return `${productsPath}?room=bedroom`;
      case "workspace":
        return `${productsPath}?room=office`;
      case "outdoor":
        return `${productsPath}?room=outdoor`;
      case "accessories":
        return `${productsPath}?subCategory=accessories`;
      case "bySet":
        return productsPath;
    }
  };

  const openWishlist = () => {
    setCartTab("wishlist");
    setCartOpen(true);
    setDrawerOpen(false);
  };

  const openCart = () => {
    setCartTab("cart");
    setCartOpen(true);
  };

  const openLogin = () => {
    setDrawerOpen(false);
    openAuth("login");
  };

  useEffect(() => {
    if (!cartOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [cartOpen]);

  return (
    <header className="relative z-30 min-h-[80px] bg-white lg:h-[150px]">
      <div className="site-shell py-4">
        {/* Top bar — desktop only */}
        <div className="hidden items-center justify-between border-b border-[#cfc9c0] pb-4 lg:flex">
          <div className="flex gap-5">
            {topLeft.map((key) => (
              <Link
                key={key}
                href={topLeftHref(key)}
                className="text-xs leading-[18px] text-[#666]"
              >
                {t(key)}
              </Link>
            ))}
          </div>
          <div className="flex gap-3 2xl:gap-5">
            {topRight.map((key) => (
              <Link
                key={key}
                href={topRightHref(key)}
                className="flex items-center gap-1 text-xs leading-[18px] text-[#666]"
              >
                {t(key)}
                {key === "showrooms" && <ChevronDown className="size-3" />}
              </Link>
            ))}
          </div>
        </div>

        {/* Mobile bar: navigation utilities, centered wordmark, cart */}
        <div className="flex items-center justify-between gap-4 pt-2 lg:h-[83px] lg:gap-0 lg:pt-0">
          <div className="flex items-center gap-1 lg:hidden">
            <button
              type="button"
              aria-label={drawerOpen ? t("closeMenu") : t("openMenu")}
              className="flex size-8 shrink-0 items-center justify-center text-nh-ink transition-colors duration-150 ease-out hover:text-nh-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent"
              onClick={() => setDrawerOpen((prev) => !prev)}
            >
              {drawerOpen ? (
                <X className="size-5 stroke-[1.5]" />
              ) : (
                <Menu className="size-5 stroke-[1.5]" />
              )}
            </button>
            <Link
              href={searchPath}
              aria-label={t("search")}
              className="flex size-8 items-center justify-center text-nh-ink transition-colors duration-150 ease-out hover:text-nh-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent"
            >
              <Search className="size-[18px]" strokeWidth={1.5} />
            </Link>
          </div>

          {/* Logo — centered on mobile, static on desktop */}
          <Link
            href={`/${locale}`}
            className="absolute left-1/2 -translate-x-1/2 lg:absolute lg:left-1/2 lg:-translate-x-1/2"
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
            aria-label={t("cart")}
            type="button"
            onClick={openCart}
            className="relative flex items-center lg:hidden"
          >
            <ShoppingCart className="size-5 stroke-[1.4]" />
            <span className="absolute -bottom-1 -left-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">
              {cartCount}
            </span>
          </button>

          {/* Desktop category nav */}
          <nav className="hidden items-center gap-4 lg:flex 2xl:gap-6">
            {nav.map((key) => (
              <Link
                key={key}
                href={navHref(key)}
                className="whitespace-nowrap text-xs font-normal uppercase leading-5 2xl:text-sm"
              >
                {t(key)}
              </Link>
            ))}
          </nav>

          {/* Desktop full icons row */}
          <div className="hidden lg:ml-auto lg:flex lg:items-center lg:gap-3 2xl:gap-5">
            <Link
              href={searchPath}
              aria-label={t("search")}
              className="flex size-8 items-center justify-center text-nh-ink transition-colors duration-150 ease-out hover:text-nh-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent"
            >
              <Search className="size-[18px]" strokeWidth={1.5} />
            </Link>
            <button aria-label={t("wishlist")} type="button" onClick={openWishlist} className="relative" data-wishlist-target>
              <Heart className="size-5 stroke-[1.4]" />
              {wishlistCount > 0 ? (
                <span className="absolute -bottom-1 -left-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">
                  {wishlistCount}
                </span>
              ) : null}
            </button>
            <button aria-label={t("cart")} type="button" onClick={openCart} className="relative" data-cart-target>
              <ShoppingCart className="size-5 stroke-[1.4]" />
              <span className="absolute -bottom-1 -left-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">
                {cartCount}
              </span>
            </button>
            {isAuthenticated ? (
              <form action="/auth/sign-out" method="POST">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="redirectTo" value={`/${locale}`} />
                <button aria-label={t("signOut")} type="submit">
                  <LogOut className="size-5 stroke-[1.4]" />
                </button>
              </form>
            ) : (
              <button aria-label={t("account")} type="button" onClick={openLogin} data-auth-trigger>
                <User className="size-5 stroke-[1.4]" />
              </button>
            )}
            {localeSwitcher}
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
                {isAuthenticated ? (
                  <form action="/auth/sign-out" method="POST">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="redirectTo" value={`/${locale}`} />
                    <button aria-label={t("signOut")} type="submit">
                      <LogOut className="size-5 stroke-[1.4]" />
                    </button>
                  </form>
                ) : (
                  <button aria-label={t("account")} type="button" onClick={openLogin} data-auth-trigger>
                    <User className="size-5 stroke-[1.4]" />
                  </button>
                )}
                <button aria-label={t("wishlist")} type="button" onClick={openWishlist} className="relative" data-wishlist-target>
                  <Heart className="size-5 stroke-[1.4]" />
                  {wishlistCount > 0 ? (
                    <span className="absolute -bottom-1 -left-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">
                      {wishlistCount}
                    </span>
                  ) : null}
                </button>
              </div>
              {localeSwitcher}
            </div>
            {/* Category nav */}
              <nav className="flex flex-col gap-3 border-b border-[#cfc9c0] py-4">
              {nav.map((key) => (
                <Link
                  key={key}
                  href={navHref(key)}
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
                  href={topLeftHref(key)}
                  onClick={() => setDrawerOpen(false)}
                  className="text-sm leading-[18px] text-[#666]"
                >
                  {t(key)}
                </Link>
              ))}
              {topRight.map((key) => (
                <Link
                  key={key}
                  href={topRightHref(key)}
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
      {cartOpen ? (
        <CartSidebar
          activeTab={cartTab}
          onClose={() => setCartOpen(false)}
          onTabChange={setCartTab}
          items={items}
          onAddCartItem={addItem}
          onClear={clearCart}
          onRemove={removeItem}
          onUpdateQuantity={updateQuantity}
          locale={locale}
          wishlistItems={wishlistItems}
          onClearWishlist={clearWishlist}
          onRemoveWishlist={removeWishlistItem}
        />
      ) : null}
    </header>
  );
}
