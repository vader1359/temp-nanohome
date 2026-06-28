"use client";

import type { ComponentType, ReactNode } from "react";
import { ChevronDown, Heart, Menu, Search, ShoppingCart, UserRound, X } from "lucide-react";
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

function CartButton({ label, variant }: { label: string; variant: "home" | "catalog" }) {
  return (
    <button aria-label={label} type="button" className={variant === "catalog" ? "text-nh-ink transition-opacity hover:opacity-70" : "relative flex items-center lg:hidden"}>
      <ShoppingCart className={variant === "catalog" ? "size-5" : "size-5 stroke-[1.4]"} />
      <span
        className={
          variant === "catalog"
            ? "absolute -right-2 -top-2 flex size-[18px] items-center justify-center rounded-full border-[0.5px] border-white bg-nh-red text-[10px] font-normal leading-[16px] text-white"
            : "absolute -bottom-1 -left-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white"
        }
        aria-label={variant === "catalog" ? "Số lượng trong giỏ hàng" : undefined}
      >
        1
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
  const isCatalog = variant === "catalog";
  const iconClassName = isCatalog ? "size-5" : "size-5 stroke-[1.4]";
  const mutedClassName = isCatalog ? "text-nh-muted" : "text-[#666]";
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
        <HeaderMainRow drawerOpen={drawerOpen} onToggleDrawer={onToggleDrawer} logo={logo} locale={locale} iconLabels={iconLabels} menuLabel={menuLabel} closeLabel={closeLabel} variant={variant} accountIcon={AccountIcon} />
        <nav className="hidden w-full items-center gap-6 lg:flex" aria-label="Categories">
          {nav.map((item) => <HeaderLinkItem key={item.key} item={item} className="text-[14px] font-medium uppercase leading-5 text-nh-ink" />)}
        </nav>
        <HeaderDrawer drawerOpen={drawerOpen} onCloseDrawer={onCloseDrawer} topLeft={topLeft} topRight={topRight} nav={nav} locale={locale} iconLabels={iconLabels} variant={variant} accountIcon={AccountIcon} borderClassName={borderClassName} mutedClassName={mutedClassName} inkClassName={inkClassName} iconClassName={iconClassName} />
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
        <HeaderMainRow drawerOpen={drawerOpen} onToggleDrawer={onToggleDrawer} logo={logo} locale={locale} iconLabels={iconLabels} menuLabel={menuLabel} closeLabel={closeLabel} variant={variant} accountIcon={AccountIcon} />
        <nav className="hidden items-center gap-6 lg:flex">{nav.map((item) => <HeaderLinkItem key={item.key} item={item} className="whitespace-nowrap text-sm font-medium uppercase leading-5" />)}</nav>
        <DesktopIcons locale={locale} iconLabels={iconLabels} variant={variant} accountIcon={AccountIcon} />
      </div>
      <HeaderDrawer drawerOpen={drawerOpen} onCloseDrawer={onCloseDrawer} topLeft={topLeft} topRight={topRight} nav={nav} locale={locale} iconLabels={iconLabels} variant={variant} accountIcon={AccountIcon} borderClassName={borderClassName} mutedClassName={mutedClassName} inkClassName={inkClassName} iconClassName={iconClassName} />
    </header>
  );
}

function HeaderMainRow({ drawerOpen, onToggleDrawer, logo, locale, iconLabels, menuLabel, closeLabel, variant, accountIcon: AccountIcon }: Pick<SharedHeaderProps, "drawerOpen" | "onToggleDrawer" | "logo" | "locale" | "iconLabels" | "menuLabel" | "closeLabel" | "variant" | "accountIcon"> & { accountIcon: ComponentType<{ className?: string }> }) {
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
          <div className="relative"><CartButton label={iconLabels.cart} variant="catalog" /></div>
          <button className="hidden text-nh-ink transition-opacity hover:opacity-70 sm:block" type="button" aria-label={iconLabels.account}><AccountIcon className="size-5" /></button>
          <LocaleToggle locale={locale} placement="desktop" />
        </div>
      ) : (
        <CartButton label={iconLabels.cart} variant="home" />
      )}
    </>
  );
}

function DesktopIcons({ locale, iconLabels, variant, accountIcon: AccountIcon }: { locale: SharedHeaderLocale; iconLabels: SharedHeaderIconLabels; variant: "home" | "catalog"; accountIcon: ComponentType<{ className?: string }> }) {
  if (variant === "catalog") return null;
  return (
    <div className="hidden lg:flex lg:items-center lg:gap-5 lg:ml-auto">
      <button aria-label={iconLabels.search}><Search className="size-5 stroke-[1.4]" /></button>
      <button aria-label={iconLabels.wishlist}><Heart className="size-5 stroke-[1.4]" /></button>
      <button aria-label={iconLabels.cart} className="relative"><ShoppingCart className="size-5 stroke-[1.4]" /><span className="absolute -bottom-1 -left-1 grid size-3 place-items-center rounded-full bg-[#930000] text-[8px] text-white">1</span></button>
      <button aria-label={iconLabels.account}><AccountIcon className="size-5 stroke-[1.4]" /></button>
      <LocaleToggle locale={locale} placement="desktop" />
    </div>
  );
}

function HeaderDrawer({ drawerOpen, onCloseDrawer, topLeft, topRight, nav, locale, iconLabels, variant, accountIcon: AccountIcon, borderClassName, mutedClassName, inkClassName, iconClassName }: Pick<SharedHeaderProps, "drawerOpen" | "onCloseDrawer" | "topLeft" | "topRight" | "nav" | "locale" | "iconLabels" | "variant" | "accountIcon"> & { accountIcon: ComponentType<{ className?: string }>; borderClassName: string; mutedClassName: string; inkClassName: string; iconClassName: string }) {
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
