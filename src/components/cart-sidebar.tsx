"use client";

import { createPortal } from "react-dom";
import {
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CartItem } from "@/components/cart/cart-context";
import type { WishlistItem } from "@/components/wishlist/wishlist-context";

export type CartSidebarTab = "wishlist" | "cart";

type CartSidebarProps = {
  isOpen: boolean;
  activeTab: CartSidebarTab;
  onClose: () => void;
  onTabChange: (tab: CartSidebarTab) => void;
  items: CartItem[];
  onAddCartItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  onClear: () => void;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  locale: string;
  wishlistItems: WishlistItem[];
  onClearWishlist: () => void;
  onRemoveWishlist: (id: string) => void;
};

export function CartSidebar({
  isOpen,
  activeTab,
  onClose,
  onTabChange,
  items,
  onAddCartItem,
  onClear,
  onRemove,
  onUpdateQuantity,
  locale,
  wishlistItems,
  onClearWishlist,
  onRemoveWishlist,
}: CartSidebarProps) {
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

  return createPortal(
    <div className="door-stage fixed inset-0 z-[9999]" data-state={isOpen ? "open" : "closed"}>
      <button
        type="button"
        aria-label="Đóng giỏ hàng"
        onClick={onClose}
        className="door-backdrop absolute inset-0 bg-black/25"
        data-state={isOpen ? "open" : "closed"}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Giỏ hàng"
        className="door-panel absolute right-0 top-0 flex h-dvh w-full max-w-[466px] flex-col overflow-hidden bg-white px-4 py-6 text-nh-ink shadow-[-18px_0_40px_rgba(0,0,0,0.12)] sm:px-6"
        data-state={isOpen ? "open" : "closed"}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
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
                      {wishlistItems.map((item) => <WishlistSidebarItem key={item.id} item={item} locale={locale} onRemove={onRemoveWishlist} />)}
                    </div>
                  ) : (
                    <div className="grid flex-1 place-items-center text-center text-[14px] leading-5 text-nh-muted">Danh sách yêu thích của bạn đang trống</div>
                  )}
                  <button type="button" onClick={addWishlistToCart} disabled={wishlistItems.length === 0} className="mt-6 h-[52px] w-full shrink-0 bg-nh-ink text-[14px] font-medium uppercase leading-5 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">THÊM VÀO GIỎ HÀNG</button>
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
                  <Link href={`/${locale}/checkout`} className="mt-6 flex h-[52px] w-full shrink-0 items-center justify-center bg-nh-ink text-[14px] font-medium leading-5 text-white transition-opacity hover:opacity-90 aria-disabled:pointer-events-none aria-disabled:opacity-50" aria-disabled={items.length === 0}>Hoàn tất giỏ hàng</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}

function parseCartPrice(price: string): number { const numeric = Number(price.replace(/[^\d]/g, "")); return Number.isFinite(numeric) ? numeric : 0; }
function formatCartPrice(value: number): string { if (value <= 0) return "Liên hệ"; return new Intl.NumberFormat("vi-VN", { currency: "VND", maximumFractionDigits: 0, style: "currency" }).format(value); }
function parseCartDiscount(discount: string | undefined): number | null { if (discount === undefined) return null; const numeric = Number(discount.replace(/[^\d.]/g, "")); return Number.isFinite(numeric) && numeric > 0 && numeric < 100 ? numeric : null; }
function hasValidCartDiscount(item: CartItem): boolean { if (!item.originalPrice || !item.discount) return false; const originalPrice = parseCartPrice(item.originalPrice); const price = parseCartPrice(item.price); const discount = parseCartDiscount(item.discount); if (originalPrice <= 0 || price <= 0 || discount === null) return false; const expectedPrice = Math.round(originalPrice * (1 - discount / 100)); return Math.abs(expectedPrice - price) <= 1; }

function WishlistSidebarItem({ item, locale, onRemove }: { item: WishlistItem; locale: string; onRemove: (id: string) => void }) {
  const hasDiscount = item.badgeTone === "sale" && item.originalPrice && item.discount;
  const href = /^\/(?:vi|en|ko)(?=\/|$)/.test(item.href) ? item.href : `/${locale}${item.href}`;
  return <article className="grid min-h-[168px] grid-cols-[104px_minmax(0,1fr)] items-center gap-6 border-b border-[#eee] pb-10"><a href={href} className="relative h-[124px] w-[104px] overflow-hidden"><Image src={item.image} alt="" fill sizes="104px" className="object-contain" /></a><div className="flex min-w-0 flex-col pl-1"><h3 className="truncate text-[14px] font-normal leading-[22px] text-nh-ink"><a href={href}>{item.name}</a></h3><p className="mt-1 text-[12px] font-medium leading-4 text-nh-ink">{item.category}</p><span className={cn("mt-3 mb-5 w-fit px-2 py-1 text-[12px] font-semibold uppercase leading-4", item.badgeTone === "sale" ? "bg-[#FBECEC] text-nh-red" : item.badgeTone === "stock" ? "bg-[#EAF7EF] text-nh-green" : "bg-[#E6E6E6] text-nh-ink")}>{item.badge}</span><button type="button" onClick={() => onRemove(item.id)} className="mt-auto w-fit text-[12px] leading-4 text-nh-ink">Xoá</button><div className="mt-3">{hasDiscount ? <div className="flex items-center gap-2"><span className="text-[12px] leading-[18px] text-[#666] line-through">{item.originalPrice}</span><span className="bg-nh-red px-1 text-[12px] font-medium leading-4 text-white">{item.discount}</span></div> : null}<p className="mt-0.5 mb-3 text-[15px] font-semibold leading-5 text-nh-ink">{item.price}</p></div></div></article>;
}

function CartSidebarItem({ item, onRemove, onUpdateQuantity }: { item: CartItem; onRemove: (id: string) => void; onUpdateQuantity: (id: string, quantity: number) => void }) {
  const unitPrice = parseCartPrice(item.price); const hasDiscount = hasValidCartDiscount(item); const linePrice = unitPrice > 0 ? unitPrice * item.quantity : 0;
  return <article className="grid min-h-[168px] grid-cols-[104px_minmax(0,1fr)] items-center gap-6 border-b border-[#eee] pb-10"><div className="relative h-[124px] w-[104px] overflow-hidden"><Image src={item.image} alt="" fill sizes="104px" className="object-contain" /></div><div className="flex min-w-0 flex-col pl-1"><h3 className="truncate text-[14px] font-normal leading-[22px] text-nh-ink">{item.name}</h3><p className="mt-1 text-[12px] font-medium leading-4 text-nh-ink">{item.category}</p><span className={cn("mt-3 mb-5 w-fit px-2 py-1 text-[12px] font-semibold uppercase leading-4", item.badgeTone === "sale" ? "bg-[#FBECEC] text-nh-red" : "bg-[#EAF7EF] text-nh-green")}>{item.badge}</span><div className="mt-auto flex items-center gap-3"><div className="flex h-[26px] w-[54px] items-center justify-between border border-[#dedad3] px-2"><button type="button" aria-label="Giảm số lượng" onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}><Minus className="size-3" /></button><span className="text-[12px] leading-[18px]">{item.quantity}</span><button type="button" aria-label="Tăng số lượng" onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}><Plus className="size-3" /></button></div><button type="button" onClick={() => onRemove(item.id)} className="text-[12px] leading-4 text-nh-ink">Xoá</button></div><div className="mt-3">{hasDiscount ? <div className="flex items-center gap-2"><span className="text-[12px] leading-[18px] text-[#666] line-through">{formatCartPrice(parseCartPrice(item.originalPrice ?? "") * item.quantity)}</span><span className="bg-nh-red px-1 text-[12px] font-medium leading-4 text-white">{item.discount}</span></div> : null}<p className="mt-0.5 text-[15px] font-semibold leading-5 text-nh-ink">{formatCartPrice(linePrice)}</p></div></div></article>;
}
