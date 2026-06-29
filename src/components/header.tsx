"use client";

import { useState } from "react";
import {
  ChevronDown,
  Heart,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, type CartItem } from "@/components/cart/cart-context";
import { cn } from "@/lib/utils";

export function Header() {
  const t = useTranslations("Header");
  const locale = useLocale();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const { items, clearCart, getItemCount, removeItem, updateQuantity } = useCart();
  const cartCount = getItemCount();
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
  const productsPath = `/${locale}/products`;

  const navHref = (key: (typeof nav)[number]): string => {
    switch (key) {
      case "products":
        return productsPath;
      case "livingRoom":
        return `${productsPath}?room=${encodeURIComponent("Phòng khách")}`;
      case "diningRoom":
        return `${productsPath}?room=${encodeURIComponent("Phòng ăn")}`;
      case "bedroom":
        return `${productsPath}?room=${encodeURIComponent("Phòng ngủ")}`;
      case "workspace":
        return `${productsPath}?room=${encodeURIComponent("Không gian làm việc")}`;
      case "outdoor":
        return `${productsPath}?category=${encodeURIComponent("Nội thất ngoài trời")}`;
      case "accessories":
        return `${productsPath}?category=${encodeURIComponent("Trang trí")}`;
      case "bySet":
        return productsPath;
    }
  };

  const submitHeaderSearch = () => {
    const value = headerSearch.trim();
    if (value.length === 0) return;
    router.push(`${productsPath}?q=${encodeURIComponent(value)}`);
    setDrawerOpen(false);
  };

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
            type="button"
            onClick={() => setCartOpen(true)}
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
            {searchOpen ? (
              <form
                className="flex items-center gap-2 border-b border-[#cfc9c0]"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitHeaderSearch();
                }}
              >
                <input
                  aria-label="Header product search"
                  className="w-[180px] bg-transparent text-xs outline-none"
                  value={headerSearch}
                  onChange={(event) => setHeaderSearch(event.target.value)}
                />
                <button aria-label="Submit search" type="submit">
                  <Search className="size-5 stroke-[1.4]" />
                </button>
              </form>
            ) : (
              <button aria-label="Search" type="button" onClick={() => setSearchOpen(true)}>
                <Search className="size-5 stroke-[1.4]" />
              </button>
            )}
            <button aria-label="Wishlist">
              <Heart className="size-5 stroke-[1.4]" />
            </button>
            <button aria-label="Cart" type="button" onClick={() => setCartOpen(true)} className="relative">
              <ShoppingCart className="size-5 stroke-[1.4]" />
              <span className="absolute -bottom-1 -left-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">
                {cartCount}
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
                <button aria-label="Search" type="button" onClick={() => setSearchOpen((open) => !open)}>
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
              {searchOpen ? (
                <form
                  className="border-b border-[#cfc9c0] py-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitHeaderSearch();
                  }}
                >
                  <input
                    aria-label="Mobile product search"
                    className="w-full bg-transparent text-sm outline-none"
                    value={headerSearch}
                    onChange={(event) => setHeaderSearch(event.target.value)}
                  />
                </form>
              ) : null}
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
      <CartSidebar open={cartOpen} onClose={() => setCartOpen(false)} items={items} onClear={clearCart} onRemove={removeItem} onUpdateQuantity={updateQuantity} />
    </header>
  );
}

function CartSidebar({
  open,
  onClose,
  items,
  onClear,
  onRemove,
  onUpdateQuantity,
}: {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onClear: () => void;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
}) {
  const [checkoutStatus, setCheckoutStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [checkoutValues, setCheckoutValues] = useState({ email: "", name: "", phone: "" });
  const [checkoutError, setCheckoutError] = useState("");

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
          email: checkoutValues.email.trim(),
          name: checkoutValues.name.trim(),
          pageUrl: window.location.href,
          phone: checkoutValues.phone.trim(),
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
      setCheckoutValues({ email: "", name: "", phone: "" });
      setCheckoutStatus("success");
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to submit cart");
      setCheckoutStatus("error");
    }
  };

  return (
    <div className={cn("fixed inset-0 z-50 transition", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
      <button type="button" aria-label="Đóng giỏ hàng" onClick={onClose} className={cn("absolute inset-0 bg-black/25 transition-opacity duration-300", open ? "opacity-100" : "opacity-0")} />
      <aside role="dialog" aria-modal="true" aria-label="Giỏ hàng" className={cn("absolute right-0 top-0 flex h-dvh w-full max-w-[466px] flex-col bg-white px-4 py-6 text-nh-ink shadow-[-18px_0_40px_rgba(0,0,0,0.12)] transition-transform duration-300 sm:px-6", open ? "translate-x-0" : "translate-x-full")}>
        <div className="flex h-full min-h-0 flex-col">
          <button type="button" aria-label="Đóng giỏ hàng" onClick={onClose} className="ml-auto flex size-6 items-center justify-center text-nh-ink transition-opacity hover:opacity-70">
            <X className="size-6 stroke-[1.4]" />
          </button>
          <div className="mt-[26px] grid h-12 grid-cols-2 bg-[#f5f3f0]">
            <button type="button" className="bg-white text-[14px] font-medium leading-5 text-nh-ink">Yêu thích</button>
            <button type="button" className="bg-nh-ink text-[14px] font-medium leading-5 text-white">Giỏ hàng</button>
          </div>
          <div className="mt-[26px] flex min-h-0 flex-1 flex-col">
            <h2 className="text-[18px] font-normal leading-7 text-[#444]">Giỏ hàng</h2>
            <div className="mt-6 flex min-h-0 flex-1 flex-col">
              <div className="flex justify-end">
                <button type="button" onClick={onClear} disabled={items.length === 0} className="text-[9px] leading-[14px] text-nh-ink transition-opacity hover:opacity-70 disabled:opacity-40">Xoá tất cả</button>
              </div>
              {items.length > 0 ? (
                <div className="mt-6 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pr-1">
                  {items.map((item) => <CartSidebarItem key={item.id} item={item} onRemove={onRemove} onUpdateQuantity={onUpdateQuantity} />)}
                </div>
              ) : (
                <div className="grid flex-1 place-items-center text-center text-[14px] leading-5 text-nh-muted">Giỏ hàng của bạn đang trống</div>
              )}
              <div className="mt-4 grid gap-2">
                <input type="text" value={checkoutValues.name} onChange={(event) => setCheckoutValues((current) => ({ ...current, name: event.target.value }))} placeholder="Họ và tên" className="h-10 border border-[#dedad3] px-3 text-[13px] leading-5 outline-none focus:border-nh-ink" />
                <input type="tel" value={checkoutValues.phone} onChange={(event) => setCheckoutValues((current) => ({ ...current, phone: event.target.value }))} placeholder="Số điện thoại" className="h-10 border border-[#dedad3] px-3 text-[13px] leading-5 outline-none focus:border-nh-ink" />
                <input type="email" value={checkoutValues.email} onChange={(event) => setCheckoutValues((current) => ({ ...current, email: event.target.value }))} placeholder="Email" className="h-10 border border-[#dedad3] px-3 text-[13px] leading-5 outline-none focus:border-nh-ink" />
              </div>
              {checkoutStatus === "success" ? <p className="mt-3 text-[12px] leading-4 text-nh-green">Đã gửi giỏ hàng.</p> : null}
              {checkoutStatus === "error" ? <p className="mt-3 text-[12px] leading-4 text-nh-red">{checkoutError || "Không thể gửi giỏ hàng. Vui lòng thử lại."}</p> : null}
              <button type="button" onClick={handleCheckout} disabled={items.length === 0 || checkoutStatus === "submitting"} className="mt-6 h-[52px] w-full bg-nh-ink text-[14px] font-medium leading-5 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                {checkoutStatus === "submitting" ? "Đang mở..." : "Hoàn tất giỏ hàng"}
              </button>
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

function CartSidebarItem({ item, onRemove, onUpdateQuantity }: { item: CartItem; onRemove: (id: string) => void; onUpdateQuantity: (id: string, quantity: number) => void }) {
  return (
    <article className="grid min-h-[148px] grid-cols-[104px_minmax(0,1fr)] gap-[14px] border-b border-[#eee] pb-6">
      <div className="relative h-[124px] w-[104px] overflow-hidden bg-[#f5f3f0]">
        <Image src={item.image} alt="" fill sizes="104px" className="object-cover" />
      </div>
      <div className="flex min-w-0 flex-col">
        <h3 className="truncate text-[14px] font-normal leading-[22px] text-nh-ink">{item.name}</h3>
        <p className="mt-1 text-[12px] font-medium leading-4 text-nh-ink">{item.category}</p>
        <span className={cn("mt-3 inline-flex h-6 w-fit items-center px-1 text-[12px] font-medium leading-4", item.badgeTone === "sale" ? "bg-nh-red text-white" : "bg-transparent text-nh-green")}>{item.badge}</span>
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
          <button type="button" onClick={() => onRemove(item.id)} className="text-[9px] leading-[14px] text-nh-ink">Xoá</button>
        </div>
        <div className="mt-3">
          {item.originalPrice ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] leading-[18px] text-[#666] line-through">{item.originalPrice}</span>
              {item.discount ? <span className="bg-nh-red px-1 text-[12px] font-medium leading-4 text-white">{item.discount}</span> : null}
            </div>
          ) : null}
          <p className="mt-0.5 text-[15px] font-semibold leading-5 text-nh-ink">{item.price}</p>
        </div>
      </div>
    </article>
  );
}
