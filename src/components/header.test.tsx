import { fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { Header } from "./header";

const headerMessages = new Map<string, string>([
  ["search", "Tìm kiếm"],
  ["wishlist", "Yêu thích"],
  ["cart", "Giỏ hàng"],
]);

vi.mock("next/image", () => ({
  default: ({ alt, src }: { readonly alt: string; readonly src: string }) => <div aria-label={alt} data-src={src} />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: Readonly<{ children: ReactNode; href: string }> & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href.replace(/^\/vi/, "")} {...props}>{children}</a>
  ),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string) => headerMessages.get(key) ?? key,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/vi/products",
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuthContext: () => ({ isAuthenticated: false, openAuth: vi.fn() }),
}));

vi.mock("@/components/cart/cart-context", () => ({
  useCart: () => ({
    addItem: vi.fn(),
    clearCart: vi.fn(),
    getItemCount: () => 0,
    items: [],
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
  }),
}));

vi.mock("@/components/wishlist/wishlist-context", () => ({
  useWishlist: () => ({
    clearWishlist: vi.fn(),
    getItemCount: () => 1,
    items: [{
      badge: "Còn hàng",
      badgeTone: "stock",
      category: "Bàn ăn",
      href: "/products/ban-an-superellipse",
      id: "product-1",
      image: "/images/product.webp",
      name: "Bàn ăn SUPERELLIPSE",
      price: "1.000.000 ₫",
    }],
    removeItem: vi.fn(),
  }),
}));

describe("Header", () => {
  it("links every translated search affordance to the locale product catalog", () => {
    render(<Header />);

    const searchLinks = screen.getAllByRole("link", { name: "Tìm kiếm" });

    expect(searchLinks).toHaveLength(2);
    for (const searchLink of searchLinks) {
      expect(searchLink).toHaveAttribute("href", "/products");
    }
  });

  it("keeps Korean available in every locale switcher", () => {
    render(<Header />);

    const koreanLinks = screen.getAllByRole("link", { name: "KO" });

    expect(koreanLinks).toHaveLength(2);
    for (const koreanLink of koreanLinks) {
      expect(koreanLink).toHaveAttribute("href", "/ko/products");
    }
  });

  it("exposes both cart controls with the Vietnamese accessible name", () => {
    render(<Header />);

    expect(screen.getAllByRole("button", { name: "Giỏ hàng" })).toHaveLength(2);
  });

  it("uses localized utility labels while preserving the locale-prefixed product link in the wishlist", () => {
    render(<Header />);

    fireEvent.click(screen.getAllByRole("button", { name: "Yêu thích" })[0]);

    expect(screen.getByRole("link", { name: "Bàn ăn SUPERELLIPSE" })).toHaveAttribute(
      "href",
      "/vi/products/ban-an-superellipse",
    );
  });

  it("routes the cart CTA to the active locale checkout", () => {
    // Given: the cart sidebar is open in the Vietnamese locale.
    render(<Header />);
    fireEvent.click(screen.getAllByRole("button", { name: "Giỏ hàng" })[0]);

    // When: the checkout CTA is inspected.
    const checkoutLink = screen.getByRole("link", { name: "Hoàn tất giỏ hàng" });

    // Then: the CTA preserves the active locale in its destination.
    expect(checkoutLink).toHaveAttribute("href", "/checkout");
  });
});
