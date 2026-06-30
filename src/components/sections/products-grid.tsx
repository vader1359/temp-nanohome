"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ProductCard, type ProductGridItem } from "@/components/products/product-card";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.css";

interface ProductsGridProps {
  products: readonly ProductGridItem[];
}

export function ProductsGrid({ products }: ProductsGridProps) {
  const t = useTranslations("ProductGrid");
  const [active, setActive] = useState(0);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [slideIdx, setSlideIdx] = useState(0);
  const [sliderLoaded, setSliderLoaded] = useState(false);

  const [sliderRef, slider] = useKeenSlider<HTMLDivElement>({
    initial: 0,
    loop: false,
    slideChanged(s) {
      setSlideIdx(s.track.details.rel);
    },
    created() {
      setSliderLoaded(true);
    },
    slides: {
      perView: 1,
      spacing: 12,
    },
  });

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

  const mobileProducts = products.slice(0, 6);
  const desktopProducts = products.slice(0, 8);

  return (
    <section className="py-12 sm:py-16 lg:py-20">
      <div className="site-shell">
        <div className="mx-auto flex w-full max-w-[720px] flex-row items-center justify-center gap-4 text-center sm:gap-8">
          {tabs.map((x, i) => (
            <button
              key={x}
              onClick={() => setActive(i)}
              className={`whitespace-nowrap text-sm font-medium leading-6 sm:text-2xl sm:leading-8 ${active === i ? "underline underline-offset-4" : "text-[#999]"}`}
            >
              {x}
            </button>
          ))}
        </div>

        {/* Mobile carousel — visible below sm */}
        <div className="mt-10 block sm:hidden">
          <div ref={sliderRef} className="keen-slider">
            {mobileProducts.map((p) => (
              <div key={p.id} className="keen-slider__slide">
                <ProductCard
                  product={p}
                  isFavorite={favorites.has(p.id)}
                  onToggleFavorite={toggleFavorite}
                />
              </div>
            ))}
          </div>
          {sliderLoaded && mobileProducts.length > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              {mobileProducts.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => slider.current?.moveToIdx(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={`size-1.5 rounded-full transition-colors ${
                    slideIdx === idx ? "bg-[#111]" : "border border-[#111]/30"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Desktop grid — visible at sm and above */}
        <div className="mt-14 hidden sm:mt-16 sm:grid sm:grid-cols-3 sm:gap-x-6 sm:gap-y-16 lg:gap-x-8 lg:gap-y-20 2xl:grid-cols-4">
          {desktopProducts.map((p, index) => (
            <div key={p.id} className={index >= 6 ? "hidden 2xl:block" : undefined}>
              <ProductCard
                product={p}
                isFavorite={favorites.has(p.id)}
                onToggleFavorite={toggleFavorite}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
