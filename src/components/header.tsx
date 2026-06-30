"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  Heart,
  Menu,
  Minus,
  Plus,
  ShoppingCart,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart, type CartItem } from "@/components/cart/cart-context";
import { useWishlist, type WishlistItem } from "@/components/wishlist/wishlist-context";
import { cn } from "@/lib/utils";

export function Header() {
  const t = useTranslations("Header");
  const locale = useLocale();
  const pathname = usePathname();
  const [currentQuery, setCurrentQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartTab, setCartTab] = useState<CartSidebarTab>("cart");
  const { items, addItem, clearCart, getItemCount, removeItem, updateQuantity } = useCart();
  const { items: wishlistItems, clearWishlist, getItemCount: getWishlistCount, removeItem: removeWishlistItem } = useWishlist();
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

  useEffect(() => {
    setCurrentQuery(window.location.search);
  }, []);

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
          <div className="flex gap-5">
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
          <nav className="hidden items-center gap-6 lg:flex">
            {nav.map((key) => (
              <Link
                key={key}
                href={navHref(key)}
                className="whitespace-nowrap text-sm font-normal uppercase leading-5"
              >
                {t(key)}
              </Link>
            ))}
          </nav>

          {/* Desktop full icons row */}
          <div className="hidden lg:flex lg:items-center lg:gap-5 lg:ml-auto">
            <button aria-label="Wishlist" type="button" onClick={openWishlist} className="relative" data-wishlist-target>
              <Heart className="size-5 stroke-[1.4]" />
              {wishlistCount > 0 ? (
                <span className="absolute -bottom-1 -left-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">
                  {wishlistCount}
                </span>
              ) : null}
            </button>
            <button aria-label="Cart" type="button" onClick={openCart} className="relative" data-cart-target>
              <ShoppingCart className="size-5 stroke-[1.4]" />
              <span className="absolute -bottom-1 -left-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">
                {cartCount}
              </span>
            </button>
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
                <button aria-label="Wishlist" type="button" onClick={openWishlist} className="relative" data-wishlist-target>
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
      <CartSidebar
        activeTab={cartTab}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onTabChange={setCartTab}
        items={items}
        onAddCartItem={addItem}
        onClear={clearCart}
        onRemove={removeItem}
        onUpdateQuantity={updateQuantity}
        wishlistItems={wishlistItems}
        onClearWishlist={clearWishlist}
        onRemoveWishlist={removeWishlistItem}
      />
    </header>
  );
}

type CartSidebarTab = "wishlist" | "cart";

function CartSidebar({
  activeTab,
  open,
  onClose,
  onTabChange,
  items,
  onAddCartItem,
  onClear,
  onRemove,
  onUpdateQuantity,
  wishlistItems,
  onClearWishlist,
  onRemoveWishlist,
}: {
  activeTab: CartSidebarTab;
  open: boolean;
  onClose: () => void;
  onTabChange: (tab: CartSidebarTab) => void;
  items: CartItem[];
  onAddCartItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  onClear: () => void;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  wishlistItems: WishlistItem[];
  onClearWishlist: () => void;
  onRemoveWishlist: (id: string) => void;
}) {
  const [checkoutStatus, setCheckoutStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [checkoutError, setCheckoutError] = useState("");
  const showingWishlist = activeTab === "wishlist";

  const addWishlistToCart = () => {
    for (const item of wishlistItems) {
      onAddCartItem({
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        originalPrice: item.originalPrice ?? undefined,
        discount: item.discount ?? undefined,
        badge: item.badge,
        badgeTone: item.badgeTone === "sale" ? "sale" : "stock",
        image: item.image,
        quantity: 1,
      });
    }
  };

  const handleCheckout = async () => {
    if (items.length === 0 || checkoutStatus === "submitting") return;

    setCheckoutStatus("submitting");
    setCheckoutError("");
    try {
      const response = await fetch("/api/cart/submit", {
        body: JSON.stringify({
          cartItems: items.map((item) => ({
            ...item,
            lineTotal: parseCartPrice(item.price) * item.quantity,
          })),
          pageUrl: window.location.href,
          source: "nanohome-cart",
          total: items.reduce((sum, item) => sum + parseCartPrice(item.price) * item.quantity, 0),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) {
        throw new Error(data?.error ?? "Unable to submit cart");
      }

      onClear();
      setCheckoutStatus("success");
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to submit cart");
      setCheckoutStatus("error");
    }
  };

  return (
    <div className={cn("fixed inset-0 z-[9999] transition", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
      <button type="button" aria-label="Đóng giỏ hàng" onClick={onClose} className={cn("absolute inset-0 bg-black/25 transition-opacity duration-300", open ? "opacity-100" : "opacity-0")} />
      <aside role="dialog" aria-modal="true" aria-label="Giỏ hàng" className={cn("absolute right-0 top-0 flex h-dvh w-full max-w-[466px] flex-col overflow-hidden bg-white px-4 py-6 text-nh-ink shadow-[-18px_0_40px_rgba(0,0,0,0.12)] transition-transform duration-300 sm:px-6", open ? "translate-x-0" : "translate-x-full")}>
        <div className="flex h-full min-h-0 flex-col">
          <button type="button" aria-label="Đóng giỏ hàng" onClick={onClose} className="ml-auto flex size-6 items-center justify-center text-nh-ink transition-opacity hover:opacity-70">
            <X className="size-6 stroke-[1.4]" />
          </button>
          <div className="mt-[26px] grid h-12 grid-cols-2 border border-nh-ink bg-[#f5f3f0]">
            <button type="button" onClick={() => onTabChange("wishlist")} className={cn("flex items-center justify-center gap-2 text-[14px] font-medium leading-5", showingWishlist ? "bg-nh-ink text-white" : "bg-white text-nh-ink")}>
              <Heart className="size-4 stroke-[1.5]" />
              Yêu thích
            </button>
            <button type="button" onClick={() => onTabChange("cart")} className={cn("flex items-center justify-center gap-2 text-[14px] font-medium leading-5", showingWishlist ? "bg-white text-nh-ink" : "bg-nh-ink text-white")}>
              <ShoppingCart className="size-4 stroke-[1.5]" />
              Giỏ hàng
            </button>
          </div>
          <div className="mt-[26px] flex min-h-0 flex-1 flex-col">
            <h2 className="text-[18px] font-normal leading-7 text-[#444]">{showingWishlist ? "Yêu thích" : "Giỏ hàng"}</h2>
            <div className="mt-6 flex min-h-0 flex-1 flex-col">
              {showingWishlist ? (
                <>
                  <div className="flex justify-end">
                    <button type="button" onClick={onClearWishlist} disabled={wishlistItems.length === 0} className="text-[12px] leading-4 text-nh-ink transition-opacity hover:opacity-70 disabled:opacity-40">Xoá tất cả</button>
                  </div>
                  {wishlistItems.length > 0 ? (
                    <div className="mt-6 flex min-h-0 flex-1 basis-0 flex-col gap-6 overflow-y-auto overscroll-contain pr-2">
                      {wishlistItems.map((item) => <WishlistSidebarItem key={item.id} item={item} onRemove={onRemoveWishlist} />)}
                    </div>
                  ) : (
                    <div className="grid flex-1 place-items-center text-center text-[14px] leading-5 text-nh-muted">Danh sách yêu thích của bạn đang trống</div>
                  )}
                  <button type="button" onClick={addWishlistToCart} disabled={wishlistItems.length === 0} className="mt-6 h-[52px] w-full shrink-0 bg-nh-ink text-[14px] font-medium uppercase leading-5 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                    THÊM VÀO GIỎ HÀNG
                  </button>
                </>
              ) : (
                <>
                  <div className="flex justify-end">
                    <button type="button" onClick={onClear} disabled={items.length === 0} className="text-[12px] leading-4 text-nh-ink transition-opacity hover:opacity-70 disabled:opacity-40">Xoá tất cả</button>
                  </div>
                  {items.length > 0 ? (
                    <div className="mt-6 flex min-h-0 flex-1 basis-0 flex-col gap-6 overflow-y-auto overscroll-contain pr-2">
                      {items.map((item) => <CartSidebarItem key={item.id} item={item} onRemove={onRemove} onUpdateQuantity={onUpdateQuantity} />)}
                    </div>
                  ) : (
                    <div className="grid flex-1 place-items-center text-center text-[14px] leading-5 text-nh-muted">Giỏ hàng của bạn đang trống</div>
                  )}
                  {checkoutStatus === "success" ? <p className="mt-4 text-[12px] leading-4 text-nh-green">Đã gửi giỏ hàng.</p> : null}
                  {checkoutStatus === "error" ? <p className="mt-3 text-[12px] leading-4 text-nh-red">{checkoutError || "Không thể gửi giỏ hàng. Vui lòng thử lại."}</p> : null}
                  <button type="button" onClick={handleCheckout} disabled={items.length === 0 || checkoutStatus === "submitting"} className="mt-6 h-[52px] w-full shrink-0 bg-nh-ink text-[14px] font-medium leading-5 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                    {checkoutStatus === "submitting" ? "Đang mở..." : "Hoàn tất giỏ hàng"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function parseCartPrice(price: string): number {
  const numeric = Number(price.replace(/[^\d]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCartPrice(value: number): string {
  if (value <= 0) return "Liên hệ";

  return new Intl.NumberFormat("vi-VN", {
    currency: "VND",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function parseCartDiscount(discount: string | undefined): number | null {
  if (discount === undefined) return null;

  const numeric = Number(discount.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 && numeric < 100 ? numeric : null;
}

function hasValidCartDiscount(item: CartItem): boolean {
  if (!item.originalPrice || !item.discount) return false;

  const originalPrice = parseCartPrice(item.originalPrice);
  const price = parseCartPrice(item.price);
  const discount = parseCartDiscount(item.discount);
  if (originalPrice <= 0 || price <= 0 || discount === null) return false;

  const expectedPrice = Math.round(originalPrice * (1 - discount / 100));
  return Math.abs(expectedPrice - price) <= 1;
}

function WishlistSidebarItem({ item, onRemove }: { item: WishlistItem; onRemove: (id: string) => void }) {
  const hasDiscount = item.badgeTone === "sale" && item.originalPrice && item.discount;

  return (
    <article className="grid min-h-[168px] grid-cols-[104px_minmax(0,1fr)] items-center gap-6 border-b border-[#eee] pb-10">
      <Link href={item.href} className="relative h-[124px] w-[104px] overflow-hidden" onClick={() => undefined}>
        <Image src={item.image} alt="" fill sizes="104px" className="object-contain" />
      </Link>
      <div className="flex min-w-0 flex-col pl-1">
        <h3 className="truncate text-[14px] font-normal leading-[22px] text-nh-ink">
          <Link href={item.href}>{item.name}</Link>
        </h3>
        <p className="mt-1 text-[12px] font-medium leading-4 text-nh-ink">{item.category}</p>
        <span className={cn("mt-3 mb-5 w-fit px-2 py-1 text-[12px] font-semibold uppercase leading-4", item.badgeTone === "sale" ? "bg-[#FBECEC] text-nh-red" : item.badgeTone === "stock" ? "bg-[#EAF7EF] text-nh-green" : "bg-[#E6E6E6] text-nh-ink")}>{item.badge}</span>
        <button type="button" onClick={() => onRemove(item.id)} className="mt-auto w-fit text-[12px] leading-4 text-nh-ink">Xoá</button>
        <div className="mt-3">
          {hasDiscount ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] leading-[18px] text-[#666] line-through">{item.originalPrice}</span>
              <span className="bg-nh-red px-1 text-[12px] font-medium leading-4 text-white">{item.discount}</span>
            </div>
          ) : null}
          <p className="mt-0.5 mb-3 text-[15px] font-semibold leading-5 text-nh-ink">{item.price}</p>
        </div>
      </div>
    </article>
  );
}

function CartSidebarItem({ item, onRemove, onUpdateQuantity }: { item: CartItem; onRemove: (id: string) => void; onUpdateQuantity: (id: string, quantity: number) => void }) {
  const unitPrice = parseCartPrice(item.price);
  const hasDiscount = hasValidCartDiscount(item);
  const linePrice = unitPrice > 0 ? unitPrice * item.quantity : 0;

  return (
    <article className="grid min-h-[168px] grid-cols-[104px_minmax(0,1fr)] items-center gap-6 border-b border-[#eee] pb-10">
      <div className="relative h-[124px] w-[104px] overflow-hidden">
        <Image src={item.image} alt="" fill sizes="104px" className="object-contain" />
      </div>
      <div className="flex min-w-0 flex-col pl-1">
        <h3 className="truncate text-[14px] font-normal leading-[22px] text-nh-ink">{item.name}</h3>
        <p className="mt-1 text-[12px] font-medium leading-4 text-nh-ink">{item.category}</p>
        <span className={cn("mt-3 mb-5 w-fit px-2 py-1 text-[12px] font-semibold uppercase leading-4", item.badgeTone === "sale" ? "bg-[#FBECEC] text-nh-red" : "bg-[#EAF7EF] text-nh-green")}>{item.badge}</span>
        <div className="mt-auto flex items-center gap-3">
          <div className="flex h-[26px] w-[54px] items-center justify-between border border-[#dedad3] px-2">
            <button type="button" aria-label="Giảm số lượng" onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}>
              <Minus className="size-3" />
            </button>
            <span className="text-[12px] leading-[18px]">{item.quantity}</span>
            <button type="button" aria-label="Tăng số lượng" onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}>
              <Plus className="size-3" />
            </button>
          </div>
          <button type="button" onClick={() => onRemove(item.id)} className="text-[12px] leading-4 text-nh-ink">Xoá</button>
        </div>
        <div className="mt-3">
          {hasDiscount ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] leading-[18px] text-[#666] line-through">{formatCartPrice(parseCartPrice(item.originalPrice ?? "") * item.quantity)}</span>
              <span className="bg-nh-red px-1 text-[12px] font-medium leading-4 text-white">{item.discount}</span>
            </div>
          ) : null}
          <p className="mt-0.5 text-[15px] font-semibold leading-5 text-nh-ink">{formatCartPrice(linePrice)}</p>
        </div>
      </div>
    </article>
  );
}
