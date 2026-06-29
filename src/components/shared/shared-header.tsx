"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import Image from "next/image";
import { ChevronDown, Heart, Menu, Minus, Plus, Search, ShoppingCart, UserRound, X } from "lucide-react";
import { useCart, type CartItem } from "@/components/cart/cart-context";
import { cn } from "@/lib/utils";

export type SharedHeaderLink = {
  key: string;
  label: ReactNode;
  href?: string;
  showChevron?: boolean;
  onClick?: () => void;
};

export type SharedHeaderLocale = {
  current: "vi" | "en" | "VN" | "EN";
  onChange?: (locale: "VN" | "EN") => void;
  desktopClassName?: string;
  mobileClassName?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  separatorClassName?: string;
};

export type SharedHeaderIconLabels = {
  search: string;
  wishlist: string;
  cart: string;
  account: string;
};

export type SharedHeaderProps = {
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  onCloseDrawer: () => void;
  logo: ReactNode;
  topLeft: SharedHeaderLink[];
  topRight: SharedHeaderLink[];
  nav: SharedHeaderLink[];
  locale: SharedHeaderLocale;
  iconLabels: SharedHeaderIconLabels;
  menuLabel: string;
  closeLabel: string;
  variant?: "home" | "catalog";
  accountIcon?: ComponentType<{ className?: string }>;
};

function HeaderLinkItem({ item, className, onClick }: { item: SharedHeaderLink; className: string; onClick?: () => void }) {
  const content = (
    <>
      {item.label}
      {item.showChevron ? <ChevronDown className="size-3" /> : null}
    </>
  );

  if (item.href) {
    return (
      <a href={item.href} onClick={onClick ?? item.onClick} className={className}>
        {content}
      </a>
    );
  }

  return (
    <span onClick={onClick ?? item.onClick} className={className}>
      {content}
    </span>
  );
}

function LocaleToggle({ locale, placement }: { locale: SharedHeaderLocale; placement: "desktop" | "mobile" }) {
  const current = locale.current.toLowerCase();
  const active = locale.activeClassName ?? "text-[#111]";
  const inactive = locale.inactiveClassName ?? "text-[#999]";
  const wrapperClassName = placement === "desktop" ? locale.desktopClassName : locale.mobileClassName;

  const localeItem = (code: "VN" | "EN") => {
    const className = cn(current === code.toLowerCase() ? active : inactive, locale.onChange && current !== code.toLowerCase() ? "hover:text-nh-ink" : undefined);

    if (!locale.onChange) {
      return <span className={className}>{code}</span>;
    }

    return (
      <button type="button" onClick={() => locale.onChange?.(code)} className={className}>
        {code}
      </button>
    );
  };

  return (
    <div className={wrapperClassName}>
      {localeItem("VN")}
      <span className={locale.separatorClassName}>|</span>
      {localeItem("EN")}
    </div>
  );
}

function CartButton({ label, variant, onClick, count }: { label: string; variant: "home" | "catalog"; onClick: () => void; count: number }) {
  return (
    <button aria-label={label} type="button" onClick={onClick} className={variant === "catalog" ? "text-nh-ink transition-opacity hover:opacity-70" : "relative flex items-center lg:hidden"}>
      <ShoppingCart className={variant === "catalog" ? "size-5" : "size-5 stroke-[1.4]"} />
      <span
        className={
          variant === "catalog"
            ? "absolute -right-2 -top-2 flex size-[18px] items-center justify-center rounded-full border-[0.5px] border-white bg-nh-red text-[10px] font-normal leading-[16px] text-white"
            : "absolute -bottom-1 -left-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white"
        }
        aria-label={variant === "catalog" ? "Số lượng trong giỏ hàng" : undefined}
      >
        {count}
      </span>
    </button>
  );
}

export function SharedHeader({
  drawerOpen,
  onToggleDrawer,
  onCloseDrawer,
  logo,
  topLeft,
  topRight,
  nav,
  locale,
  iconLabels,
  menuLabel,
  closeLabel,
  variant = "home",
  accountIcon: AccountIcon = UserRound,
}: SharedHeaderProps) {
  const [cartOpen, setCartOpen] = useState(false);
  const { items, clearCart, getItemCount, removeItem, updateQuantity } = useCart();
  const cartCount = getItemCount();
  const isCatalog = variant === "catalog";
  const iconClassName = isCatalog ? "size-5" : "size-5 stroke-[1.4]";
  const borderClassName = isCatalog ? "border-nh-border" : "border-[#cfc9c0]";
  const inkClassName = isCatalog ? "text-nh-ink" : "text-[#111]";

  if (isCatalog) {
    return (
      <header className="flex flex-col items-center gap-4 bg-white px-4 py-4 sm:px-6 lg:px-12">
        <div className="hidden w-full items-center justify-between gap-8 lg:flex">
          <nav className="flex items-center gap-5" aria-label="Sub navigation">
            {topLeft.map((item) => <HeaderLinkItem key={item.key} item={item} className="text-[12px] font-normal leading-[18px] text-nh-muted" />)}
          </nav>
          <nav className="flex items-center gap-5" aria-label="Utility navigation">
            {topRight.map((item) => <HeaderLinkItem key={item.key} item={item} className="flex items-center gap-1 text-[12px] font-normal leading-[18px] text-nh-muted" />)}
          </nav>
        </div>
        <div className="h-px w-full bg-nh-border" />
        <HeaderMainRow drawerOpen={drawerOpen} onToggleDrawer={onToggleDrawer} onOpenCart={() => setCartOpen(true)} cartCount={cartCount} logo={logo} locale={locale} iconLabels={iconLabels} menuLabel={menuLabel} closeLabel={closeLabel} variant={variant} accountIcon={AccountIcon} />
        <nav className="hidden w-full items-center gap-6 lg:flex" aria-label="Categories">
          {nav.map((item) => <HeaderLinkItem key={item.key} item={item} className="text-[14px] font-medium uppercase leading-5 text-nh-ink" />)}
        </nav>
        <HeaderDrawer drawerOpen={drawerOpen} onCloseDrawer={onCloseDrawer} topLeft={topLeft} topRight={topRight} nav={nav} locale={locale} iconLabels={iconLabels} variant={variant} accountIcon={AccountIcon} borderClassName={borderClassName} inkClassName={inkClassName} iconClassName={iconClassName} />
        <CartSidebar open={cartOpen} onClose={() => setCartOpen(false)} items={items} onClear={clearCart} onRemove={removeItem} onUpdateQuantity={updateQuantity} />
      </header>
    );
  }

  return (
    <header className="relative z-30 min-h-[80px] bg-white px-6 py-4 lg:h-[150px] lg:px-12">
      <div className="hidden items-center justify-between border-b border-[#cfc9c0] pb-4 lg:flex">
        <div className="flex gap-5">{topLeft.map((item) => <HeaderLinkItem key={item.key} item={item} className="text-xs leading-[18px] text-[#666]" />)}</div>
        <div className="flex gap-5">{topRight.map((item) => <HeaderLinkItem key={item.key} item={item} className="flex items-center gap-1 text-xs leading-[18px] text-[#666]" />)}</div>
      </div>
      <div className="flex items-center justify-between gap-4 pt-2 lg:h-[83px] lg:pt-0">
        <HeaderMainRow drawerOpen={drawerOpen} onToggleDrawer={onToggleDrawer} onOpenCart={() => setCartOpen(true)} cartCount={cartCount} logo={logo} locale={locale} iconLabels={iconLabels} menuLabel={menuLabel} closeLabel={closeLabel} variant={variant} accountIcon={AccountIcon} />
        <nav className="hidden items-center gap-6 lg:flex">{nav.map((item) => <HeaderLinkItem key={item.key} item={item} className="whitespace-nowrap text-sm font-medium uppercase leading-5" />)}</nav>
        <DesktopIcons locale={locale} iconLabels={iconLabels} variant={variant} accountIcon={AccountIcon} onOpenCart={() => setCartOpen(true)} cartCount={cartCount} />
      </div>
      <HeaderDrawer drawerOpen={drawerOpen} onCloseDrawer={onCloseDrawer} topLeft={topLeft} topRight={topRight} nav={nav} locale={locale} iconLabels={iconLabels} variant={variant} accountIcon={AccountIcon} borderClassName={borderClassName} inkClassName={inkClassName} iconClassName={iconClassName} />
      <CartSidebar open={cartOpen} onClose={() => setCartOpen(false)} items={items} onClear={clearCart} onRemove={removeItem} onUpdateQuantity={updateQuantity} />
    </header>
  );
}

function HeaderMainRow({ drawerOpen, onToggleDrawer, onOpenCart, cartCount, logo, locale, iconLabels, menuLabel, closeLabel, variant, accountIcon: AccountIcon }: Pick<SharedHeaderProps, "drawerOpen" | "onToggleDrawer" | "logo" | "locale" | "iconLabels" | "menuLabel" | "closeLabel" | "variant" | "accountIcon"> & { accountIcon: ComponentType<{ className?: string }>; onOpenCart: () => void; cartCount: number }) {
  const isCatalog = variant === "catalog";
  return (
    <>
      <button type="button" aria-label={drawerOpen ? closeLabel : menuLabel} className={isCatalog ? "flex size-8 shrink-0 items-center justify-center text-nh-ink lg:hidden" : "flex size-8 shrink-0 items-center justify-center text-[#111] lg:hidden"} onClick={onToggleDrawer}>
        {drawerOpen ? <X className="size-6" /> : <Menu className="size-6" />}
      </button>
      {logo}
      {isCatalog ? (
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <button className="hidden text-nh-ink transition-opacity hover:opacity-70 sm:block" type="button" aria-label={iconLabels.search}><Search className="size-5" /></button>
          <button className="hidden text-nh-ink transition-opacity hover:opacity-70 sm:block" type="button" aria-label={iconLabels.wishlist}><Heart className="size-5" /></button>
          <div className="relative"><CartButton label={iconLabels.cart} variant="catalog" onClick={onOpenCart} count={cartCount} /></div>
          <button className="hidden text-nh-ink transition-opacity hover:opacity-70 sm:block" type="button" aria-label={iconLabels.account}><AccountIcon className="size-5" /></button>
          <LocaleToggle locale={locale} placement="desktop" />
        </div>
      ) : (
        <CartButton label={iconLabels.cart} variant="home" onClick={onOpenCart} count={cartCount} />
      )}
    </>
  );
}

function DesktopIcons({ locale, iconLabels, variant, accountIcon: AccountIcon, onOpenCart, cartCount }: { locale: SharedHeaderLocale; iconLabels: SharedHeaderIconLabels; variant: "home" | "catalog"; accountIcon: ComponentType<{ className?: string }>; onOpenCart: () => void; cartCount: number }) {
  if (variant === "catalog") return null;
  return (
    <div className="hidden lg:flex lg:items-center lg:gap-5 lg:ml-auto">
      <button aria-label={iconLabels.search}><Search className="size-5 stroke-[1.4]" /></button>
      <button aria-label={iconLabels.wishlist}><Heart className="size-5 stroke-[1.4]" /></button>
      <button type="button" onClick={onOpenCart} aria-label={iconLabels.cart} className="relative"><ShoppingCart className="size-5 stroke-[1.4]" /><span className="absolute -bottom-1 -left-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">{cartCount}</span></button>
      <button aria-label={iconLabels.account}><AccountIcon className="size-5 stroke-[1.4]" /></button>
      <LocaleToggle locale={locale} placement="desktop" />
    </div>
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
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Giỏ hàng"
        className={cn(
          "absolute right-0 top-0 flex h-dvh w-full max-w-[466px] flex-col bg-white px-4 py-6 text-nh-ink shadow-[-18px_0_40px_rgba(0,0,0,0.12)] transition-transform duration-300 sm:px-6",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
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
                <input
                  type="text"
                  value={checkoutValues.name}
                  onChange={(event) => setCheckoutValues((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Họ và tên"
                  className="h-10 border border-[#dedad3] px-3 text-[13px] leading-5 outline-none focus:border-nh-ink"
                />
                <input
                  type="tel"
                  value={checkoutValues.phone}
                  onChange={(event) => setCheckoutValues((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="Số điện thoại"
                  className="h-10 border border-[#dedad3] px-3 text-[13px] leading-5 outline-none focus:border-nh-ink"
                />
                <input
                  type="email"
                  value={checkoutValues.email}
                  onChange={(event) => setCheckoutValues((current) => ({ ...current, email: event.target.value }))}
                  placeholder="Email"
                  className="h-10 border border-[#dedad3] px-3 text-[13px] leading-5 outline-none focus:border-nh-ink"
                />
              </div>
              {checkoutStatus === "success" ? <p className="mt-3 text-[12px] leading-4 text-nh-green">Đã gửi giỏ hàng.</p> : null}
              {checkoutStatus === "error" ? <p className="mt-3 text-[12px] leading-4 text-nh-red">{checkoutError || "Không thể gửi giỏ hàng. Vui lòng thử lại."}</p> : null}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={items.length === 0 || checkoutStatus === "submitting"}
                className="mt-6 h-[52px] w-full bg-nh-ink text-[14px] font-medium leading-5 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checkoutStatus === "submitting" ? "Đang mở..." : "Hoàn thất giỏ hàng"}
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
        <span
          className={cn(
            "mt-3 inline-flex h-6 w-fit items-center px-1 text-[12px] font-medium leading-4",
            item.badgeTone === "sale" ? "bg-nh-red text-white" : "bg-transparent text-nh-green",
          )}
        >
          {item.badge}
        </span>
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

function HeaderDrawer({ drawerOpen, onCloseDrawer, topLeft, topRight, nav, locale, iconLabels, variant, accountIcon: AccountIcon, borderClassName, inkClassName, iconClassName }: Pick<SharedHeaderProps, "drawerOpen" | "onCloseDrawer" | "topLeft" | "topRight" | "nav" | "locale" | "iconLabels" | "variant" | "accountIcon"> & { accountIcon: ComponentType<{ className?: string }>; borderClassName: string; inkClassName: string; iconClassName: string }) {
  const isCatalog = variant === "catalog";
  return (
    <div className={`overflow-hidden transition-all duration-300 ease-in-out lg:hidden ${drawerOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
      <div className={cn("border-t pt-4 pb-2", borderClassName)}>
        <div className={cn("flex items-center justify-between border-b pb-4", borderClassName, isCatalog && "sm:hidden")}>
          <div className={cn("flex items-center gap-5", inkClassName)}>
            <button type="button" aria-label={iconLabels.search}><Search className={iconClassName} /></button>
            <button type="button" aria-label={iconLabels.wishlist}><Heart className={iconClassName} /></button>
            <button type="button" aria-label={iconLabels.account}><AccountIcon className={iconClassName} /></button>
          </div>
          <LocaleToggle locale={locale} placement="mobile" />
        </div>
        {isCatalog ? (
          <div className="flex flex-col gap-3 border-b border-nh-border py-4 sm:pt-0">
            {topLeft.map((item) => <HeaderLinkItem key={item.key} item={item} className="text-[13px] font-normal leading-[18px] text-nh-muted" />)}
          </div>
        ) : null}
        <nav className={cn("flex flex-col gap-3 border-b py-4", borderClassName)} aria-label={isCatalog ? "Categories" : undefined}>
          {nav.map((item) => <HeaderLinkItem key={item.key} item={item} onClick={onCloseDrawer} className={isCatalog ? "text-sm font-medium uppercase leading-5 text-nh-ink" : "text-sm font-medium uppercase leading-5 text-[#111]"} />)}
        </nav>
        <div className="flex flex-col gap-3 pt-4">
          {isCatalog ? null : topLeft.map((item) => <HeaderLinkItem key={item.key} item={item} onClick={onCloseDrawer} className="text-sm leading-[18px] text-[#666]" />)}
          {topRight.map((item) => <HeaderLinkItem key={item.key} item={item} onClick={onCloseDrawer} className={cn("flex items-center gap-1 leading-[18px]", isCatalog ? "text-[13px] text-nh-muted" : "text-sm text-[#666]")} />)}
        </div>
      </div>
    </div>
  );
}
