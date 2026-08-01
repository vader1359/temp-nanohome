"use client";

import { createPortal } from "react-dom";
import { useState } from "react";
import {
  Check,
  Heart,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  isCartSyncing?: boolean;
  cartSyncError?: string | null;
  onRetryCartSync?: () => void;
  useDurableCheckout?: boolean;
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
  isCartSyncing = false,
  cartSyncError = null,
  onRetryCartSync,
  useDurableCheckout = false,
}: CartSidebarProps) {
  const t = useTranslations("Cart");
  const showingWishlist = activeTab === "wishlist";
  const checkoutBlocked = useDurableCheckout && (isCartSyncing || cartSyncError !== null);
  const formatPrice = (value: number) => formatCartPrice(value, locale, t("contactPrice"));

  const [mobileStep, setMobileStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [vatRequested, setVatRequested] = useState(false);
  const [vatCompanyName, setVatCompanyName] = useState("");
  const [vatTaxCode, setVatTaxCode] = useState("");
  const [vatInvoiceAddress, setVatInvoiceAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) {
      setMobileStep(1);
      setName("");
      setPhone("");
      setEmail("");
      setVatRequested(false);
      setVatCompanyName(""); setVatTaxCode(""); setVatInvoiceAddress("");
      setSubmitSuccess(false);
    }
  }

  const isValidName = (n: string) => /^[\p{L}\p{M}\s.'-]{2,100}$/u.test(n.trim());
  const isValidPhone = (p: string) => /^[0-9+\-\s()]{9,15}$/.test(p.trim());
  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  // Reset state when closing
  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setMobileStep(1);
      setName("");
      setPhone("");
      setEmail("");
      setVatRequested(false);
      setVatCompanyName(""); setVatTaxCode(""); setVatInvoiceAddress("");
      setSubmitSuccess(false);
      setPrevIsOpen(false);
    }, 300);
  };

  const handleClear = () => {
    onClear();
  };

  const subtotal = items.reduce((acc, item) => acc + (parseCartPrice(item.price) * item.quantity), 0);

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/cart/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          source: "nanohome-cart",
          pageUrl: typeof window !== "undefined" ? window.location.href : "",
          total: subtotal,
          vatRequested,
          vatCompanyName, vatTaxCode, vatInvoiceAddress,
          zaloPayRequested: false,
          vnPayRequested: false,
          cartItems: items.map(i => ({
            id: i.id,
            name: i.name,
            category: i.category,
            quantity: i.quantity,
            price: i.price,
            originalPrice: i.originalPrice,
            discount: i.discount,
            badge: i.badge,
            badgeTone: i.badgeTone,
            image: i.image,
            lineTotal: parseCartPrice(i.price) * i.quantity
          }))
        })
      });
      if (response.ok) {
        setSubmitSuccess(true);
        for (const item of items) {
          onRemove(item.id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

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
        aria-label={t("close")}
        onClick={handleClose}
        className="door-backdrop absolute inset-0 bg-black/25 lg:block"
        data-state={isOpen ? "open" : "closed"}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("cart")}
        className="door-panel absolute right-0 top-0 flex h-dvh w-full max-w-full flex-col overflow-hidden bg-white shadow-[-18px_0_40px_rgba(0,0,0,0.12)] lg:max-w-[466px]"
        data-state={isOpen ? "open" : "closed"}
        aria-hidden={!isOpen ? true : false}
        inert={!isOpen ? true : undefined}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 px-4 pt-6 sm:px-6 sm:pt-6 lg:hidden">
              {mobileStep === 1 && !submitSuccess ? (
                <div className="flex flex-1 min-w-0 items-center border border-nh-ink bg-[#f5f3f0] h-[40px] p-0.5">
                  <button
                    type="button"
                    onClick={() => onTabChange("wishlist")}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 h-full text-[13px] font-medium transition-colors",
                      showingWishlist ? "bg-nh-ink text-white" : "text-nh-ink"
                    )}
                  >
                    <Heart className="size-4 stroke-[1.5]" />
                    {t("wishlist")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onTabChange("cart")}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 h-full text-[13px] font-medium transition-colors",
                      showingWishlist ? "text-nh-ink" : "bg-nh-ink text-white"
                    )}
                  >
                    <ShoppingCart className="size-4 stroke-[1.5]" />
                    {t("cart")}
                  </button>
                </div>
              ) : mobileStep > 1 && !submitSuccess ? (
                <div className="flex flex-1 min-w-0 items-center h-[40px]">
                  <button type="button" onClick={() => setMobileStep(prev => prev - 1 as 1|2|3)} className="text-[14px] leading-5 text-nh-ink underline">{t("back")}</button>
                </div>
              ) : (
                <div className="flex flex-1 min-w-0 items-center h-[40px]" />
              )}
              <button type="button" aria-label={t("close")} onClick={handleClose} className="flex size-6 shrink-0 items-center justify-center text-nh-ink transition-opacity hover:opacity-70">
                <X className="size-6 stroke-[1.4]" />
              </button>
            </div>
            <div className="hidden lg:flex items-center justify-between gap-6 px-4 pt-6 sm:px-6 sm:pt-6">
              <button type="button" aria-label={t("close")} onClick={handleClose} className="flex size-6 shrink-0 items-center justify-center text-nh-ink transition-opacity hover:opacity-70 ml-auto">
                <X className="size-6 stroke-[1.4]" />
              </button>
            </div>
          </div>

          <div className="mt-[26px] hidden h-12 grid-cols-2 border border-nh-ink bg-[#f5f3f0] lg:grid mx-4 sm:mx-6">
            <button type="button" onClick={() => onTabChange("wishlist")} className={cn("flex items-center justify-center gap-2 text-[14px] font-medium leading-5", showingWishlist ? "bg-nh-ink text-white" : "bg-white text-nh-ink")}>
              <Heart className="size-4 stroke-[1.5]" />
              {t("wishlist")}
            </button>
            <button type="button" onClick={() => onTabChange("cart")} className={cn("flex items-center justify-center gap-2 text-[14px] font-medium leading-5", showingWishlist ? "bg-white text-nh-ink" : "bg-nh-ink text-white")}>
              <ShoppingCart className="size-4 stroke-[1.5]" />
              {t("cart")}
            </button>
          </div>

          <div className="mt-4 lg:mt-[26px] flex min-h-0 flex-1 flex-col px-4 sm:px-6">
            {!submitSuccess && (
              <div className={cn(
                "flex justify-between items-center",
                !showingWishlist && mobileStep > 1 ? "hidden lg:flex" : "flex"
              )}>
                <h2 className="text-[18px] font-normal leading-7 text-[#444]">
                  {showingWishlist ? t("wishlist") : t("cart")}
                </h2>
                <button
                  type="button"
                  onClick={showingWishlist ? onClearWishlist : handleClear}
                  disabled={showingWishlist ? wishlistItems.length === 0 : items.length === 0}
                  className="text-[12px] leading-4 text-nh-red transition-opacity hover:opacity-70 disabled:opacity-40"
                >
                  {t("clearAll")}
                </button>
              </div>
            )}

            <div className={cn("flex min-h-0 flex-1 flex-col", showingWishlist ? "mt-4 lg:mt-6 bg-[#F7F7F7] -mx-4 sm:-mx-6 px-4 sm:px-6 pt-4 lg:bg-[#F7F7F7] lg:-mx-6 lg:px-6 lg:pt-6" : "mt-4 lg:mt-6")}>
              {submitSuccess ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-[#EAF7EF]">
                    <Check className="size-8 text-nh-green" />
                  </div>
                  <h3 className="mt-6 text-[20px] font-medium leading-7 text-nh-ink">{t("requestSuccessTitle")}</h3>
                  <p className="mt-2 text-[14px] leading-5 text-[#666]">{t("requestSuccessDescription")}</p>
                  <button type="button" onClick={handleClose} className="mt-8 h-12 w-full bg-nh-ink text-[14px] font-medium uppercase text-white hover:opacity-90">{t("continueShopping")}</button>
                </div>
              ) : showingWishlist ? (
                <>
                  {wishlistItems.length > 0 ? (
                    <div className="mt-4 flex min-h-0 flex-1 basis-0 flex-col gap-4 overflow-y-auto overscroll-contain pb-6 scrollbar-hide">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                        {wishlistItems.map((item) => <WishlistSidebarItem key={item.id} item={item} locale={locale} onRemove={onRemoveWishlist} removeLabel={t("removeWishlist", { name: item.name })} />)}
                      </div>
                    </div>
                  ) : (
                    <div className="grid flex-1 place-items-center text-center text-[14px] leading-5 text-nh-muted">{t("emptyWishlist")}</div>
                  )}
                  <button type="button" onClick={addWishlistToCart} disabled={wishlistItems.length === 0} className="mt-4 mb-6 h-[52px] w-full shrink-0 bg-nh-ink text-[14px] font-medium uppercase leading-5 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">{t("addWishlistToCart")}</button>
                </>
              ) : (
                <>
                    {/* Mobile Checkout Steps */}
                    <div className={cn("flex min-h-0 flex-1 flex-col lg:hidden")}>
                      {mobileStep === 1 && (
                        <>
                          {items.length > 0 ? (
                          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pr-2">
                            <div className="flex flex-col gap-6">
                              {items.map((item) => (
                                <CartSidebarItem key={item.id} item={item} locale={locale} contactPriceLabel={t("contactPrice")} decreaseLabel={t("decreaseQuantity")} increaseLabel={t("increaseQuantity")} removeLabel={t("remove")} onRemove={onRemove} onUpdateQuantity={onUpdateQuantity} />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="grid flex-1 place-items-center text-center text-[14px] leading-5 text-nh-muted">{t("emptyCart")}</div>
                        )}
                      </>
                    )}

                    {mobileStep === 2 && (
                      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pb-6 px-1">
                        <h3 className="text-[16px] font-medium leading-6 text-nh-ink">{t("contactInfo")}</h3>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="checkout-name">{t("fullName")} <span className="text-nh-red">*</span></Label>
                            <Input
                              id="checkout-name"
                              type="text"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              placeholder={t("namePlaceholder")}
                              className="h-12"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="checkout-phone">{t("phone")} <span className="text-nh-red">*</span></Label>
                            <Input
                              id="checkout-phone"
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder={t("phonePlaceholder")}
                              className="h-12"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="checkout-email">{t("email")} <span className="text-nh-red">*</span></Label>
                            <Input
                              id="checkout-email"
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder={t("emailPlaceholder")}
                              className="h-12"
                            />
                          </div>
                          <div className="flex items-center space-x-2 pt-2">
                            <input
                              id="checkout-vat"
                              type="checkbox"
                              checked={vatRequested}
                              onChange={(e) => setVatRequested(e.target.checked)}
                              className="size-4 rounded border-[#CCCCCC] accent-nh-ink cursor-pointer"
                            />
                            <Label htmlFor="checkout-vat" className="text-sm font-medium leading-none cursor-pointer">
                              {t("vatRequest")}
                            </Label>
                          </div>
                          {vatRequested && (
                            <div className="space-y-3 pt-2">
                              <Input value={vatCompanyName} onChange={(e) => setVatCompanyName(e.target.value)} placeholder={t("companyPlaceholder")} className="h-11" />
                              <Input value={vatTaxCode} onChange={(e) => setVatTaxCode(e.target.value)} placeholder={t("taxCodePlaceholder")} className="h-11" />
                              <Input value={vatInvoiceAddress} onChange={(e) => setVatInvoiceAddress(e.target.value)} placeholder={t("invoiceAddressPlaceholder")} className="h-11" />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {mobileStep === 3 && (
                      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-6 px-1">
                        <h3 className="mb-4 text-[16px] font-medium leading-6 text-nh-ink">{t("confirmInfo")}</h3>

                        <div className="mb-6 space-y-4 rounded-sm border border-[#eee] bg-[#fafafa] p-4">
                          <div className="flex justify-between border-b border-[#eee] pb-4 gap-4">
                            <span className="text-[14px] text-[#666]">{t("fullName")}</span>
                            <span className="text-[14px] font-medium text-nh-ink max-w-[60%] break-all text-right">{name}</span>
                          </div>

                          <div className="flex justify-between border-b border-[#eee] pb-4 gap-4">
                            <span className="text-[14px] text-[#666]">{t("phone")}</span>
                            <span className="text-[14px] font-medium text-nh-ink max-w-[60%] break-all text-right">{phone}</span>
                          </div>

                          <div className="flex justify-between border-b border-[#eee] pb-4 gap-4">
                            <span className="text-[14px] text-[#666]">{t("email")}</span>
                            <span className="text-[14px] font-medium text-nh-ink max-w-[60%] break-all text-right">{email}</span>
                          </div>

                          {vatRequested && (
<div className="flex justify-between gap-4">
                               <span className="text-[14px] text-[#666]">{t("vatInvoice")}</span>
                              <span className="text-[14px] font-medium text-nh-ink text-right">{t("yes")}</span>
                            </div>
                          )}
                        </div>

                        <div className="mb-6 rounded-sm border border-[#eee] bg-[#fafafa] p-4">
                          <span className="mb-3 block text-[14px] text-[#666]">{t("selectedProducts", { count: items.reduce((acc, item) => acc + item.quantity, 0) })}</span>
                          <div className="flex flex-col gap-4">
                            {items.map(item => (
                              <div key={item.id} className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-4">
                                <div className="relative h-[82px] w-[64px] overflow-hidden bg-white">
                                  <Image src={item.image} alt={item.name} fill sizes="64px" className="object-contain p-1" />
                                </div>
                                <div className="flex min-w-0 flex-col pt-1">
                                  <h4 className="line-clamp-2 text-[13px] font-normal leading-5 text-nh-ink">{item.name}</h4>
                                  <p className="mt-1 text-[11px] font-medium leading-4 text-[#666]">{item.category}</p>
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="text-[12px] text-nh-ink">{t("quantityShort", { count: item.quantity })}</span>
                                    <span className="text-[13px] font-medium text-nh-ink">{formatPrice(parseCartPrice(item.price) * item.quantity)}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fixed Mobile Bottom Bar */}
                    {!submitSuccess && items.length > 0 && (
                      <div className="mt-4 mb-6 flex flex-col gap-4 border-t border-[#eee] bg-[#F7F7F7] -mx-4 px-4 pt-4 sm:-mx-6 sm:px-6 lg:hidden">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-[#666]">{t("shippingFee")}</span>
                            <span className="text-[12px] font-medium text-nh-green bg-[#EAF7EF] px-1.5 py-0.5">{t("free")}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[14px] font-medium text-nh-ink">{t("total")}</span>
                            <span className="text-[18px] font-semibold text-nh-ink">{formatPrice(subtotal)}</span>
                          </div>
                        </div>

                        {useDurableCheckout && cartSyncError !== null ? (
                          <p className="text-center text-[12px] leading-4 text-nh-red" role="alert">
                            {cartSyncError}
                          </p>
                        ) : null}

                        <div className="flex w-full">
                          {mobileStep === 1 && (
                            useDurableCheckout ? (
                              checkoutBlocked ? (
                                <button
                                  type="button"
                                  disabled={isCartSyncing}
                                  onClick={cartSyncError === null ? undefined : onRetryCartSync}
                                  className="flex h-[52px] w-full shrink-0 items-center justify-center bg-nh-ink text-[14px] font-medium uppercase leading-5 text-white transition-opacity disabled:cursor-wait disabled:opacity-50"
                                  aria-label={isCartSyncing ? t("syncing") : t("retrySyncAria")}
                                >
                                  {isCartSyncing ? t("syncingEllipsis") : t("retrySync")}
                                </button>
                              ) : (
                                <Link
                                  href={`/${locale}/checkout`}
                                  prefetch={true}
                                  onClick={handleClose}
                                  className="flex h-[52px] w-full shrink-0 items-center justify-center gap-2 bg-nh-ink text-[14px] font-medium uppercase leading-5 text-white transition-opacity hover:opacity-90"
                                  aria-label={t("completeCart")}
                                >
                                  <ShoppingBag className="size-4" />
                                  {t("completeCart")}
                                </Link>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={() => setMobileStep(2)}
                                className="flex h-[52px] w-full shrink-0 items-center justify-center bg-nh-ink text-[14px] font-medium uppercase leading-5 text-white transition-opacity hover:opacity-90 gap-2"
                                aria-label={t("placeOrder")}
                              >
                                <ShoppingBag className="size-4" />
                                {t("placeOrder")}
                              </button>
                            )
                          )}

                          {mobileStep === 2 && (
                            <button
                              type="button"
                              disabled={!isValidName(name) || !isValidPhone(phone) || !isValidEmail(email)}
                              onClick={() => setMobileStep(3)}
                              className="flex h-[52px] w-full shrink-0 items-center justify-center bg-nh-ink text-[14px] font-medium uppercase leading-5 text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                              aria-label={t("continue")}
                            >
                              {t("continue")}
                            </button>
                          )}

                          {mobileStep === 3 && (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={handleFinalSubmit}
                              className="flex h-[52px] w-full shrink-0 items-center justify-center bg-nh-ink text-[14px] font-medium uppercase leading-5 text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                              aria-label={t("submitRequest")}
                            >
                              {isSubmitting ? t("submitting") : t("submitRequest")}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Desktop view (unchanged) */}
                  <div className="hidden lg:flex min-h-0 flex-1 flex-col" data-testid="desktop-cart">
                    {items.length > 0 ? (
                      <>
                        <div className="mt-6 flex min-h-0 flex-1 basis-0 flex-col gap-6 overflow-y-auto overscroll-contain pr-2">
                          {items.map((item) => <CartSidebarItem key={item.id} item={item} locale={locale} contactPriceLabel={t("contactPrice")} decreaseLabel={t("decreaseQuantity")} increaseLabel={t("increaseQuantity")} removeLabel={t("remove")} onRemove={onRemove} onUpdateQuantity={onUpdateQuantity} />)}
                        </div>
                        {checkoutBlocked ? (
                          <button
                            type="button"
                            disabled={isCartSyncing}
                            onClick={cartSyncError === null ? undefined : onRetryCartSync}
                            data-testid="checkout-link"
                            className="mt-4 mb-6 flex h-[52px] shrink-0 items-center justify-center bg-nh-ink text-[14px] font-medium uppercase leading-5 text-white transition-opacity disabled:cursor-wait disabled:opacity-50"
                          >
                            {isCartSyncing ? t("syncingEllipsis") : t("retrySync")}
                          </button>
                        ) : (
                          <Link
                            href={`/${locale}/checkout`}
                            prefetch={true}
                            onClick={handleClose}
                            data-testid="checkout-link"
                            className="mt-4 mb-6 flex h-[52px] items-center justify-center bg-nh-ink text-[14px] font-medium uppercase leading-5 text-white transition-opacity hover:opacity-90 shrink-0"
                          >
                            {t("completeCart")}
                          </Link>
                        )}
                        {useDurableCheckout && cartSyncError !== null ? (
                          <p className="-mt-4 mb-6 text-center text-[12px] leading-4 text-nh-red" role="alert">
                            {cartSyncError}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <div className="grid flex-1 place-items-center text-center text-[14px] leading-5 text-nh-muted">{t("emptyCart")}</div>
                    )}
                  </div>
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
function formatCartPrice(value: number, locale: string, contactPriceLabel: string): string {
  if (value <= 0) return contactPriceLabel;
  const numberLocale = locale === "en" ? "en-US" : locale === "ko" ? "ko-KR" : "vi-VN";
  return new Intl.NumberFormat(numberLocale, { currency: "VND", maximumFractionDigits: 0, style: "currency" }).format(value);
}
function parseCartDiscount(discount: string | undefined): number | null { if (discount === undefined) return null; const numeric = Number(discount.replace(/[^\d.]/g, "")); return Number.isFinite(numeric) && numeric > 0 && numeric < 100 ? numeric : null; }
function hasValidCartDiscount(item: CartItem): boolean { if (!item.originalPrice || !item.discount) return false; const originalPrice = parseCartPrice(item.originalPrice); const price = parseCartPrice(item.price); const discount = parseCartDiscount(item.discount); if (originalPrice <= 0 || price <= 0 || discount === null) return false; const expectedPrice = Math.round(originalPrice * (1 - discount / 100)); return Math.abs(expectedPrice - price) <= 1; }

function WishlistSidebarItem({ item, locale, onRemove, removeLabel }: { item: WishlistItem; locale: string; onRemove: (id: string) => void; removeLabel: string }) {
  const hasDiscount = item.badgeTone === "sale" && item.originalPrice && item.discount;
  const href = /^\/(?:vi|en|ko)(?=\/|$)/.test(item.href) ? item.href : `/${locale}${item.href}`;
  return (
    <article className="flex flex-col bg-white p-3 w-full h-full group">
      <div className="flex items-start justify-between mb-2">
        {item.badgeTone === "sale" ? (
          <span className="bg-nh-red px-1.5 py-0.5 text-[10px] font-bold uppercase text-white shadow-sm mt-0.5">
            {item.badge}
          </span>
        ) : item.badgeTone === "stock" ? (
          <span className="bg-[#EAF7EF] px-1.5 py-0.5 text-[10px] font-bold uppercase text-nh-green shadow-sm mt-0.5">
            {item.badge}
          </span>
        ) : (
          <span className="bg-[#E6E6E6] px-1.5 py-0.5 text-[10px] font-bold uppercase text-nh-ink shadow-sm mt-0.5">
            {item.badge}
          </span>
        )}
        <button
          type="button"
          aria-label={removeLabel}
          onClick={() => onRemove(item.id)}
          className="p-1 -mr-1 -mt-1 text-nh-red transition-opacity hover:opacity-70 shrink-0"
        >
          <Heart className="size-4 fill-current stroke-current" />
        </button>
      </div>
      <a href={href} className="relative aspect-square w-full overflow-hidden mb-4 shrink-0 block">
        <Image src={item.image} alt="" fill sizes="(max-width: 640px) 50vw, 150px" className="object-contain" />
      </a>
      <div className="flex flex-col flex-1 min-w-0 text-left">
        <h3 className="line-clamp-2 break-words text-[12px] leading-[16px] text-nh-ink mb-1">
          <a href={href} data-testid="wishlist-link">{item.name}</a>
        </h3>
        <p className="text-[11px] font-medium text-nh-ink mb-2 truncate">{item.category}</p>
        <div className="mt-auto flex flex-col pt-2">
          {hasDiscount ? (
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[11px] leading-[14px] text-[#666] line-through">{item.originalPrice}</span>
              <span className="bg-nh-red px-1 text-[10px] font-medium leading-[14px] text-white">{item.discount}</span>
            </div>
          ) : null}
          <p className="text-[13px] font-semibold text-nh-ink">{item.price}</p>
        </div>
      </div>
    </article>
  );
}

function CartSidebarItem({ item, locale, contactPriceLabel, decreaseLabel, increaseLabel, removeLabel, onRemove, onUpdateQuantity }: { item: CartItem; locale: string; contactPriceLabel: string; decreaseLabel: string; increaseLabel: string; removeLabel: string; onRemove: (id: string) => void; onUpdateQuantity: (id: string, quantity: number) => void }) {
  const unitPrice = parseCartPrice(item.price); const hasDiscount = hasValidCartDiscount(item); const linePrice = unitPrice > 0 ? unitPrice * item.quantity : 0;
  return <article className="grid sm:min-h-[168px] grid-cols-[96px_minmax(0,1fr)] items-start sm:items-center gap-8 border-b border-[#eee] pb-8 sm:pb-10 sm:grid-cols-[104px_minmax(0,1fr)] sm:gap-6"><div className="relative h-[124px] w-[96px] overflow-hidden sm:w-[104px]"><Image src={item.image} alt="" fill sizes="(max-width: 640px) 96px, 104px" className="object-contain" /></div><div className="flex min-w-0 flex-col"><h3 className="line-clamp-2 break-words sm:truncate text-[12px] sm:text-[14px] font-normal leading-5 sm:leading-[22px] text-nh-ink">{item.name}</h3><p className="mt-1 text-[11px] sm:text-[12px] font-medium leading-4 text-nh-ink">{item.category}</p><span className={cn("mt-3 mb-5 w-fit px-2 py-1 text-[10px] sm:text-[12px] font-semibold uppercase leading-4", item.badgeTone === "sale" ? "bg-[#FBECEC] text-nh-red" : "bg-[#EAF7EF] text-nh-green")}>{item.badge}</span><div className="mt-auto flex items-center gap-5 sm:gap-3"><div className="flex h-[28px] sm:h-[26px] w-[72px] sm:w-[54px] items-center justify-between border border-[#dedad3] px-3 sm:px-2"><button type="button" aria-label={decreaseLabel} onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}><Minus className="size-3" /></button><span className="text-[13px] sm:text-[12px] leading-[18px]">{item.quantity}</span><button type="button" aria-label={increaseLabel} onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}><Plus className="size-3" /></button></div><button type="button" onClick={() => onRemove(item.id)} className="text-[13px] sm:text-[12px] leading-4 text-nh-ink">{removeLabel}</button></div><div className="mt-3">{hasDiscount ? <div className="flex flex-wrap items-center gap-2"><span className="text-[11px] sm:text-[12px] leading-[18px] text-[#666] line-through">{formatCartPrice(parseCartPrice(item.originalPrice ?? "") * item.quantity, locale, contactPriceLabel)}</span><span className="bg-nh-red px-1 text-[11px] sm:text-[12px] font-medium leading-4 text-white">{item.discount}</span></div> : null}<p className="mt-0.5 text-[14px] sm:text-[15px] font-semibold leading-5 text-nh-ink">{formatCartPrice(linePrice, locale, contactPriceLabel)}</p></div></div></article>;
}
