"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.css";
import { ProductCard, type ProductGridItem } from "@/components/products/product-card";
import { relatedSet as fallbackRelatedSet, type RelatedProduct } from "./mock-data";

interface Section3RelatedProps {
  products?: RelatedProduct[];
  collectionName?: string;
}

function toProductGridItem(product: RelatedProduct, index: number): ProductGridItem {
  return {
    id: product.name || String(index),
    brand: product.brand,
    name: product.name,
    subtitle: product.category,
    status: product.available ? "in_stock" : "out_of_stock",
    imageUrl: product.image,
    href: product.href ?? "#",
    oldPrice: null,
    discount: null,
    price: product.price,
    swatches: [],
  };
}

export function Section3Related({ products = fallbackRelatedSet }: Section3RelatedProps) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const items = products.slice(0, 8).map(toProductGridItem);
  const [sliderRef, slider] = useKeenSlider<HTMLDivElement>({
    initial: 0,
    mode: "free-snap",
    slideChanged(s) {
      setCurrentSlide(s.track.details.rel);
    },
    created() {
      setLoaded(true);
    },
    slides: { perView: 1.25, spacing: 12 },
    breakpoints: {
      "(min-width: 640px)": { slides: { perView: 2.25, spacing: 20 } },
      "(min-width: 1024px)": { slides: { perView: 4, spacing: 24 } },
    },
  });

  const maxIdx = slider.current?.track.details?.maxIdx ?? 0;
  const canPrev = loaded && currentSlide > 0;
  const canNext = loaded && currentSlide < maxIdx;

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <section className="bg-white py-12 md:py-16">
      <div className="site-shell flex flex-col gap-8">
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col items-start gap-3">
            <h2 className="text-[24px] font-medium text-[#444]">Sản phẩm cùng bộ</h2>
          </div>
          <a href="#" className="mt-1 text-[14px] font-normal text-[#111] hover:underline">
            Xem tất cả
          </a>
        </div>

        <div className="relative overflow-hidden">
          <div ref={sliderRef} className="keen-slider overflow-visible">
            {items.map((product) => (
              <div className="keen-slider__slide" key={product.id}>
                <ProductCard
                  product={product}
                  isFavorite={favorites.has(product.id)}
                  onToggleFavorite={toggleFavorite}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            aria-label="Sản phẩm trước"
            disabled={!canPrev}
            onClick={() => slider.current?.prev()}
            className="absolute left-2 top-[38%] flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF5EB] text-[#18181B] shadow-sm transition disabled:opacity-30 sm:left-0 sm:-translate-x-1/2"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="Sản phẩm tiếp theo"
            disabled={!canNext}
            onClick={() => slider.current?.next()}
            className="absolute right-2 top-[38%] flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF5EB] text-[#18181B] shadow-sm transition disabled:opacity-30 sm:right-0 sm:translate-x-1/2"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </section>
  );
}
