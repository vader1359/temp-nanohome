import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const imageProps: { fetchPriority?: "auto" | "high" }[] = [];

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: Readonly<{ children: React.ReactNode; href: string }>) => <a href={href}>{children}</a>,
}));

vi.mock("next/image", () => ({
  default: ({ fetchPriority }: Readonly<{ fetchPriority?: "auto" | "high" }>) => {
    imageProps.push({ fetchPriority });
    return null;
  },
}));

import { ProductCard } from "./product-card";

const product = {
  brand: "nanoHome",
  brandLogoUrl: null,
  href: "/vi/products/chair",
  id: "chair-1",
  imageUrl: "/images/home/hero/hero-1.webp",
  name: "Chair",
  oldPrice: null,
  price: "1.000.000 ₫",
  status: "in_stock" as const,
  subtitle: "Chair subtitle",
};

describe("ProductCard", () => {
  it("prioritizes only the explicitly above-the-fold product image", () => {
    imageProps.length = 0;
    const { rerender } = render(<ProductCard product={product} isFavorite={false} onToggleFavorite={vi.fn()} fetchPriority="high" />);

    expect(imageProps[0]?.fetchPriority).toBe("high");

    imageProps.length = 0;
    rerender(<ProductCard product={product} isFavorite={false} onToggleFavorite={vi.fn()} />);

    expect(imageProps[0]?.fetchPriority).toBe("auto");
  });
});
