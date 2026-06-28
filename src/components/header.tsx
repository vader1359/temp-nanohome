"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { SharedHeader, type SharedHeaderLink } from "@/components/shared";

export function Header() {
  const t = useTranslations("Header");
  const locale = useLocale();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const topLeft = ["brandFurniture", "brandLighting", "brandPreLove"].map((key) => ({
    key,
    href: "#",
    label: t(key),
  })) satisfies SharedHeaderLink[];
  const topRight = ["showrooms", "about", "news", "contact", "signIn"].map((key) => ({
    key,
    href: "#",
    label: t(key),
    showChevron: key === "showrooms",
  })) satisfies SharedHeaderLink[];
  const nav = ["products", "livingRoom", "diningRoom", "bedroom", "workspace", "outdoor", "accessories", "bySet"].map((key) => ({
    key,
    href: "#",
    label: t(key),
  })) satisfies SharedHeaderLink[];

  return (
    <SharedHeader
      drawerOpen={drawerOpen}
      onToggleDrawer={() => setDrawerOpen((prev) => !prev)}
      onCloseDrawer={() => setDrawerOpen(false)}
      logo={(
        <Link href={`/${locale}`} className="absolute left-1/2 -translate-x-1/2 lg:static lg:left-auto lg:translate-x-0">
          <Image src="/images/nanohome-logo.svg" alt="nanoHome" width={154} height={32} priority className="h-auto w-[100px] lg:w-auto" />
        </Link>
      )}
      topLeft={topLeft}
      topRight={topRight}
      nav={nav}
      locale={{
        current: locale as "vi" | "en",
        desktopClassName: "flex gap-1.5 text-xs",
        mobileClassName: "flex gap-1.5 text-xs",
      }}
      iconLabels={{ search: "Search", wishlist: "Wishlist", cart: "Cart", account: "Account" }}
      menuLabel="Open menu"
      closeLabel="Close menu"
    />
  );
}
