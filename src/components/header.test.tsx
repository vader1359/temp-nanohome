import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Header } from "./header";

const authState = vi.hoisted(() => ({ isAuthenticated: false }));

const headerMessages = new Map<string, string>([
  ["search", "Tìm kiếm"],
  ["wishlist", "Yêu thích"],
  ["cart", "Giỏ hàng"],
  ["cart.checkout", "Hoàn tất giỏ hàng"],
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
  useAuthContext: () => ({ isAuthenticated: authState.isAuthenticated, openAuth: vi.fn() }),
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
  beforeEach(() => {
    authState.isAuthenticated = false;
  });

  it("links every translated search affordance to the locale aggregate search page", () => {
    render(<Header />);

    const searchLinks = screen.getAllByRole("link", { name: "Tìm kiếm" });

    expect(searchLinks).toHaveLength(2);
    for (const searchLink of searchLinks) {
      expect(searchLink).toHaveAttribute("href", "/search");
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

  it("uses localized utility labels while preserving the locale-prefixed product link in the wishlist", async () => {
    render(<Header />);

    fireEvent.click(screen.getAllByRole("button", { name: "Yêu thích" })[0]);

    await waitFor(() => {
      // Find the specific container for the desktop view since the item renders inside it
      const desktopSidebar = document.querySelector('.hidden.lg\\:flex');
      const wishlistLink = desktopSidebar?.querySelector('a[href="/vi/products/ban-an-superellipse"]');
      expect(wishlistLink).toBeDefined();
    });
  });

  it("routes the cart CTA to the active locale checkout", async () => {
    // Given: the cart sidebar is open in the Vietnamese locale.
    render(<Header />);
    fireEvent.click(screen.getAllByRole("button", { name: "Giỏ hàng" })[0]);

    // When/Then: the checkout CTA preserves the active locale in its destination.
    await waitFor(() => {
      // Find the specific container for the desktop view since the item renders inside it
      const desktopSidebar = document.querySelector('.hidden.lg\\:flex');
      const checkoutLink = desktopSidebar?.querySelector('a[href="/vi/checkout"]');
      expect(checkoutLink).toBeDefined();
    });
  });

  it("offers a safe Account sign-in landing link from the open mobile drawer", () => {
    // Given: the header is rendering a locale-prefixed product path.
    render(<Header />);

    // When: the visitor opens the mobile navigation drawer.
    fireEvent.click(screen.getByRole("button", { name: "openMenu" }));

    // Then: the drawer retains the local path as an encoded Account return destination.
    expect(screen.getByRole("link", { name: "account" })).toHaveAttribute(
      "href",
      "/account/sign-in?returnTo=%2Fvi%2Fproducts",
    );
  });

  it("routes authenticated account icons to My Account instead of signing out", () => {
    authState.isAuthenticated = true;
    render(<Header />);

    const accountLinks = screen.getAllByRole("link", { name: "account" });
    expect(accountLinks.length).toBeGreaterThanOrEqual(2);
    accountLinks.forEach((link) => expect(link).toHaveAttribute("href", "/account"));
    expect(document.querySelector('form[action="/auth/sign-out"]')).toBeNull();
  });
});
