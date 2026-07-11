import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Header } from "./header";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { readonly alt: string; readonly src: string }) => <div aria-label={alt} data-src={src} />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { readonly children: React.ReactNode; readonly href: string }) => (
    <a href={href.replace(/^\/vi/, "")}>{children}</a>
  ),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string) => key,
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
  it("preserves the locale-prefixed product link in the wishlist", () => {
    render(<Header />);

    fireEvent.click(screen.getAllByRole("button", { name: "Wishlist" })[0]);

    expect(screen.getByRole("link", { name: "Bàn ăn SUPERELLIPSE" })).toHaveAttribute(
      "href",
      "/vi/products/ban-an-superellipse",
    );
  });
});
