"use client";

import { ProductCard } from "./product-card";

export const SWATCHES = [
  "#111111",
  "#62616E",
  "#84818A",
  "#ABABAB",
  "#E8E8E8",
  "#4D2D1E",
  "#B39480",
  "#374067",
  "#3C69AD",
  "#676F57",
  "#3BB552",
  "#FCD240",
  "#ED9042",
  "#C23B4F",
];

export type ProductGridItem = {
  id: string;
  brand: string;
  brandLogoUrl?: string | null;
  name: string;
  subtitle: string;
  status: "CÓ SẴN" | "HẾT HÀNG" | "SALE";
  imageUrl: string;
  href: string;
  oldPrice: string | null;
  discount: string | null;
  price: string;
  swatches: readonly string[];
};

export interface ProductGridProps {
  products: readonly ProductGridItem[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
}

export function ProductGrid({ products, favorites, onToggleFavorite }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <section className="rounded border border-nh-border bg-white p-8 text-center text-sm text-nh-muted">
        Chưa có dữ liệu sản phẩm để hiển thị.
      </section>
    );
  }

  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3 xl:gap-9">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          isFavorite={favorites.has(product.id)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </section>
  );
}
