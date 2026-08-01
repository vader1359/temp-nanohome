"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
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
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart/cart-context";
import { useWishlist } from "@/components/wishlist/wishlist-context";
import { useAuthContext } from "@/components/auth/auth-provider";
import type { CartSidebarTab } from "./cart-sidebar";
import { useHeaderScroll } from "@/hooks/use-header-scroll";

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
  const [hasOpenedCart, setHasOpenedCart] = useState(false);
  const [cartTab, setCartTab] = useState<CartSidebarTab>("cart");
  const [isMounted, setIsMounted] = useState(false);
  const { isCompact } = useHeaderScroll();
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        document.documentElement.style.setProperty(
          "--header-height",
          `${entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height}px`
        );
      }
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--header-height");
    };
  }, []);
  const {
    items,
    addItem,
    clearCart,
    getItemCount,
    isSyncing: isCartSyncing,
    removeItem,
    retrySync: retryCartSync,
    syncError: cartSyncError,
    updateQuantity,
  } = useCart();
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
  const accountSignInPath = `/${locale}/account/sign-in?returnTo=${encodeURIComponent(`${pathname}${currentQuery}`)}`;
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
        return `${productsPath}?filter_category=den-trang-tri`;
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
    setHasOpenedCart(true);
    setCartOpen(true);
    setDrawerOpen(false);
  };

  const openCart = () => {
    setCartTab("cart");
    setHasOpenedCart(true);
    setCartOpen(true);
  };

  const openLogin = () => {
    setDrawerOpen(false);
    openAuth("login");
  };

  useLayoutEffect(() => {
    if (!cartOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPaddingRight = document.body.style.paddingRight;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.paddingRight = previousBodyPaddingRight;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [cartOpen]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-30 min-h-[80px] data-[compact=true]:min-h-12 bg-white lg:h-auto lg:data-[compact=true]:min-h-[64px] border-b border-[#cfc9c0] transform-gpu transition-[min-height] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[min-height] motion-reduce:transition-none"
      data-compact={isCompact}
    >
      <div
        className="site-shell relative py-4 transform-gpu transition-[padding] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[padding] data-[compact=true]:py-0 lg:data-[compact=true]:py-2 motion-reduce:transition-none"
        data-compact={isCompact}
      >
        {/* Top bar — desktop only */}
        <div
          className="hidden items-center justify-between border-b border-[#cfc9c0] lg:flex overflow-hidden transition-[max-height,opacity,padding] duration-300 ease-in-out motion-reduce:transition-none data-[compact=true]:max-h-0 data-[compact=true]:opacity-0 data-[compact=true]:pb-0 data-[compact=false]:max-h-[50px] data-[compact=false]:opacity-100 data-[compact=false]:pb-4"
          data-compact={isCompact}
          aria-hidden={isCompact}
          inert={isCompact ? true : undefined}
        >
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
        <div
          className="flex w-full items-center justify-between gap-4 pt-2 transform-gpu transition-[min-height,padding] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[min-height,padding] data-[compact=true]:min-h-12 data-[compact=true]:pt-0 lg:data-[compact=true]:min-h-0 motion-reduce:transition-none lg:flex-wrap lg:justify-center lg:gap-0 lg:pt-0 lg:flex-col lg:items-center"
          data-compact={isCompact}
        >
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

          {/* Logo — absolute centered on all screens */}
          <Link
            href={`/${locale}`}
            className="absolute left-1/2 top-[14px] -translate-x-1/2 transform-gpu transition-[top,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[top,transform] motion-reduce:transition-none data-[compact=true]:top-[15px] data-[compact=true]:scale-90 lg:top-[14px] lg:data-[compact=true]:top-[7px] lg:data-[compact=true]:scale-75"
            data-compact={isCompact}
          >
            <Image
              src="/images/nanohome-logo.svg"
              alt="nanoHome"
              width={154}
              height={32}
              loading="eager"
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
            {isMounted && cartCount > 0 ? (
              <span className="absolute -top-1 -right-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">
                {cartCount}
              </span>
            ) : null}
          </button>

          {/* Desktop full navigation row */}
          <div
            className="hidden w-full items-center justify-between transition-[margin,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none lg:flex lg:data-[compact=true]:translate-y-[7px] data-[compact=true]:mt-0 data-[compact=true]:mb-0 data-[compact=false]:mt-16 data-[compact=false]:mb-2"
            data-compact={isCompact}
          >
            {/* Desktop category nav */}
            <nav
              className="flex items-center gap-3 xl:gap-4 2xl:gap-6 overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out motion-reduce:transition-none data-[compact=true]:max-w-0 data-[compact=true]:opacity-0 data-[compact=false]:max-w-[900px] data-[compact=false]:opacity-100"
              data-compact={isCompact}
              aria-hidden={isCompact}
              inert={isCompact ? true : undefined}
            >
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
            <div className="flex items-center gap-3 2xl:gap-5 ml-auto">
              <Link
                href={searchPath}
                aria-label={t("search")}
                className="flex size-8 items-center justify-center text-nh-ink transition-colors duration-150 ease-out hover:text-nh-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent"
              >
                <Search className="size-[18px]" strokeWidth={1.5} />
              </Link>
              <button aria-label={t("wishlist")} type="button" onClick={openWishlist} className="relative" data-wishlist-target>
                <Heart className="size-5 stroke-[1.4]" />
                {isMounted && wishlistCount > 0 ? (
                  <span className="absolute -top-1 -right-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">
                    {wishlistCount}
                  </span>
                ) : null}
              </button>
              <button aria-label={t("cart")} type="button" onClick={openCart} className="relative" data-cart-target>
                <ShoppingCart className="size-5 stroke-[1.4]" />
                {isMounted && cartCount > 0 ? (
                  <span className="absolute -top-1 -right-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">
                    {cartCount}
                  </span>
                ) : null}
              </button>
              {isAuthenticated ? (
                <Link aria-label={t("account")} href={`/${locale}/account`}>
                  <User className="size-5 stroke-[1.4]" />
                </Link>
              ) : (
                <button aria-label={t("account")} type="button" onClick={openLogin} data-auth-trigger>
                  <User className="size-5 stroke-[1.4]" />
                </button>
              )}
              {localeSwitcher}
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
                {isAuthenticated ? (
                  <Link aria-label={t("account")} href={`/${locale}/account`} onClick={() => setDrawerOpen(false)}>
                    <User className="size-5 stroke-[1.4]" />
                  </Link>
                ) : (
                  <button aria-label={t("account")} type="button" onClick={openLogin} data-auth-trigger>
                    <User className="size-5 stroke-[1.4]" />
                  </button>
                )}
                <button aria-label={t("wishlist")} type="button" onClick={openWishlist} className="relative" data-wishlist-target>
                  <Heart className="size-5 stroke-[1.4]" />
                  {wishlistCount > 0 ? (
                    <span className="absolute -top-1 -right-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">
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
              {isAuthenticated ? (
                <Link
                  href={`/${locale}/account`}
                  onClick={() => setDrawerOpen(false)}
                  className="text-sm leading-[18px] text-[#666]"
                >
                  {t("account")}
                </Link>
              ) : (
                <Link
                  href={accountSignInPath}
                  onClick={() => setDrawerOpen(false)}
                  className="text-sm leading-[18px] text-[#666]"
                >
                  {t("account")}
                </Link>
              )}
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
      {hasOpenedCart ? (
        <CartSidebar
          isOpen={cartOpen}
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
          isCartSyncing={isCartSyncing}
          cartSyncError={cartSyncError}
          onRetryCartSync={retryCartSync}
          useDurableCheckout={isAuthenticated}
        />
      ) : null}
    </header>
  );
}
