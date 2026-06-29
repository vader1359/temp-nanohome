"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ProductCard, type ProductGridItem } from "@/components/products/product-card";

interface ProductsGridProps {
  products: readonly ProductGridItem[];
}

export function ProductsGrid({ products }: ProductsGridProps) {
  const t = useTranslations("ProductGrid");
  const [active, setActive] = useState(0);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(8);

  const tabs = [t("tabTrending"), t("tabBestSeller"), t("tabNew")];

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <section className="py-12 sm:py-16 lg:py-20">
      <div className="site-shell">
        <div className="mx-auto flex w-full max-w-[720px] flex-col items-center justify-center gap-3 text-center sm:flex-row sm:gap-8">
          {tabs.map((x, i) => (
            <button
              key={x}
              onClick={() => setActive(i)}
              className={`text-lg font-medium leading-8 sm:text-2xl ${active === i ? "underline underline-offset-4" : "text-[#999]"}`}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="mt-14 grid grid-cols-2 gap-x-3 gap-y-12 sm:mt-16 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-16 lg:gap-x-8 lg:gap-y-20 2xl:grid-cols-4">
          {products.slice(0, visibleCount).map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              isFavorite={favorites.has(p.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
        {visibleCount < products.length && (
          <div className="mt-20 text-center">
            <button
              className="h-[52px] bg-[#111] px-8 text-sm font-medium uppercase text-white"
              onClick={() => setVisibleCount((count) => Math.min(count + 4, products.length))}
            >
              Xem thêm
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
