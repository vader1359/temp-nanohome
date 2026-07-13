"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";
import { useKeenSlider } from "keen-slider/react";
import { ProductCard, toWishlistItem, type ProductGridItem } from "@/components/products/product-card";
import "keen-slider/keen-slider.css";
import { useWishlist } from "@/components/wishlist/wishlist-context";

const lifestylePairs = [
  {
    lifestyleImage: "/images/usm_haller_bedside.webp",
    reverse: false,
  },
  {
    lifestyleImage: "/images/ikebana.webp",
    reverse: true,
  },
] as const;

interface FeaturedProductsProps {
  products: readonly ProductGridItem[];
}

export function FeaturedProducts({ products }: FeaturedProductsProps) {
  const t = useTranslations("Featured");
  const { hasItem, toggleItem } = useWishlist();
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

  const toggleFavorite = (product: ProductGridItem) => {
    toggleItem(toWishlistItem(product));
  };

  return (
    <section
      data-section="featured-products"
      className="flex flex-col items-center gap-10 bg-white py-12 sm:gap-[60px] sm:py-16 lg:py-20"
    >
      <div className="site-shell">
        <div className="mx-auto mb-10 flex w-full max-w-[802px] flex-col items-center gap-4 text-center sm:mb-12">
          <p className="w-full text-sm font-medium uppercase leading-5 text-[#444]">
            {t("eyebrow")}
          </p>
          <h2 className="flex w-full items-center justify-center text-[32px] font-medium leading-10 text-[#111]">
            {t("heading")}
          </h2>
        </div>

        <div className="block md:hidden">
          <div ref={sliderRef} className="keen-slider">
            {products.map((product, index) => {
              const pair = lifestylePairs[index] ?? lifestylePairs[index % lifestylePairs.length];

              const lifestyle = (
                <div className="relative aspect-[4/5] w-full overflow-hidden">
                  <Image
                    src={pair.lifestyleImage}
                    alt=""
                    fill
                    sizes="calc(100vw - 32px)"
                    className="object-cover"
                  />
                </div>
              );

              const card = (
                <div className="flex w-full items-center justify-center p-4">
                  <div className="w-full max-w-[500px]">
                    <ProductCard
                      product={product}
                      isFavorite={hasItem(product.id)}
                      onToggleFavorite={() => toggleFavorite(product)}
                    />
                  </div>
                </div>
              );

              return (
                <div key={product.id} className="keen-slider__slide">
                  <div className="grid w-full grid-cols-1 gap-6 overflow-hidden">
                    {pair.reverse ? card : lifestyle}
                    {pair.reverse ? lifestyle : card}
                  </div>
                </div>
              );
            })}
          </div>
          {sliderLoaded && products.length > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              {products.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => slider.current?.moveToIdx(idx)}
                  aria-label={`Go to featured slide ${idx + 1}`}
                  className={`size-1.5 rounded-full transition-colors ${
                    slideIdx === idx ? "bg-[#111]" : "border border-[#111]/30"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="hidden w-full flex-col gap-6 md:flex">
          {products.map((product, index) => {
            const pair = lifestylePairs[index] ?? lifestylePairs[index % lifestylePairs.length];

            const lifestyle = (
              <div className="relative aspect-[4/5] w-full overflow-hidden">
                <Image
                  src={pair.lifestyleImage}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 660px, 100vw"
                  className="object-cover"
                />
              </div>
            );

            const card = (
              <div className="flex aspect-[4/5] w-full items-center justify-center p-4 sm:p-8 lg:p-12 min-[1440px]:p-20">
                <div className="w-full max-w-[500px]">
                  <ProductCard
                    product={product}
                    isFavorite={hasItem(product.id)}
                    onToggleFavorite={() => toggleFavorite(product)}
                  />
                </div>
              </div>
            );

            return (
              <div
                key={product.id}
                className="grid w-full grid-cols-1 items-center gap-6 overflow-hidden md:grid-cols-2"
              >
                {pair.reverse ? card : lifestyle}
                {pair.reverse ? lifestyle : card}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
