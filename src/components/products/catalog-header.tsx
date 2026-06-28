"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { SharedHeader, type SharedHeaderLink } from "@/components/shared";

const SUBNAV_LEFT = [
  "nanoHome Nội Thất",
  "nanoHome Chiếu Sáng",
  "nanoHome Pre - Love",
];

const SUBNAV_RIGHT = ["Về chúng tôi", "Tin tức", "Liên hệ", "Đăng nhập"];

const CATEGORIES = [
  "Sản phẩm",
  "Phòng khách",
  "Phòng Ăn",
  "Phòng Ngủ",
  "Không Gian Làm Việc",
  "Ngoài Trời",
  "Phụ kiện & trang trí",
  "Theo bộ",
];

export function CatalogHeader() {
  const [locale, setLocale] = useState<"VN" | "EN">("VN");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const topLeft = SUBNAV_LEFT.map((label) => ({ key: label, label })) satisfies SharedHeaderLink[];
  const topRight = ["Showrooms", ...SUBNAV_RIGHT].map((label) => ({
    key: label,
    label,
    showChevron: label === "Showrooms",
  })) satisfies SharedHeaderLink[];
  const nav = CATEGORIES.map((label) => ({ key: label, label })) satisfies SharedHeaderLink[];

  return (
    <SharedHeader
      variant="catalog"
      drawerOpen={drawerOpen}
      onToggleDrawer={() => setDrawerOpen((prev) => !prev)}
      onCloseDrawer={() => setDrawerOpen(false)}
      logo={(
        <a
          className="font-freeman flex flex-1 items-center justify-center text-[22px] font-semibold tracking-tight text-nh-ink lg:flex-none"
          href="#"
          aria-label="nanoHome"
        >
          nanoHome
        </a>
      )}
      topLeft={topLeft}
      topRight={topRight}
      nav={nav}
      locale={{
        current: locale,
        onChange: setLocale,
        desktopClassName: "hidden items-center gap-1.5 sm:flex",
        mobileClassName: "flex items-center gap-1.5 text-[12px] leading-[18px]",
        activeClassName: "text-nh-ink",
        inactiveClassName: "text-nh-muted transition-opacity",
        separatorClassName: "text-[12px] font-normal leading-[18px] text-nh-ink",
      }}
      iconLabels={{ search: "Tìm kiếm", wishlist: "Yêu thích", cart: "Giỏ hàng", account: "Tài khoản" }}
      menuLabel="Mở menu"
      closeLabel="Đóng menu"
      accountIcon={User}
    />
  );
}
