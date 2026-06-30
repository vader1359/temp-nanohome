"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Hotspot data                                                       */
/* ------------------------------------------------------------------ */

type HotspotProduct = {
  image: string;
  brand: string;
  name: string;
  price: string;
};

type Hotspot = {
  position: string;
  cardPlacement: "above-right" | "below" | "above-left";
  product: HotspotProduct;
};

const hotspotData: Hotspot[] = [
  {
    position: "left-[19%] top-[58%]",
    cardPlacement: "above-right",
    product: {
      image: "/images/p_lc2.png",
      brand: "Cassina",
      name: "Fauteuil Grand Confort, petit modèle",
      price: "45.500.000 đ",
    },
  },
  {
    position: "left-[53%] top-[46%]",
    cardPlacement: "below",
    product: {
      image: "/images/p_febo.png",
      brand: "Maxalto",
      name: "Febo Chair",
      price: "10.000.000 đ",
    },
  },
  {
    position: "right-[18%] top-[61%]",
    cardPlacement: "above-left",
    product: {
      image: "/images/feat_egg_main.png",
      brand: "Fritz Hansen",
      name: "Egg Chair",
      price: "32.900.000 đ",
    },
  },
];

const cardPositionClasses: Record<Hotspot["cardPlacement"], string> = {
  "above-right": "bottom-full left-0 mb-3",
  below: "top-full left-1/2 -translate-x-1/2 mt-3",
  "above-left": "bottom-full right-0 mb-3",
};

const heroImages = [
  "/images/home/hero/hero-1.jpg",
  "/images/home/hero/hero-2.jpg",
  "/images/home/hero/hero-3.jpg",
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Hero({ products = hotspotData.map((hotspot) => hotspot.product) }: { products?: HotspotProduct[] }) {
  const t = useTranslations("Hero");
  const [activeIndex, setActiveIndex] = useState(0);
  const [openCard, setOpenCard] = useState<number | null>(null);
  const hotspotRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleHotspotClick = useCallback((index: number) => {
    setOpenCard((prev) => (prev === index ? null : index));
  }, []);

  /* Dismiss card when clicking outside any hotspot container */
  useEffect(() => {
    if (openCard === null) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inside = hotspotRefs.current[openCard]?.contains(target);
      if (!inside) setOpenCard(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [openCard]);

  const goToPrevious = () => {
    setActiveIndex((current) => (current === 0 ? heroImages.length - 1 : current - 1));
  };

  const goToNext = () => {
    setActiveIndex((current) => (current === heroImages.length - 1 ? 0 : current + 1));
  };

  return (
    <section className="relative min-h-[280px] aspect-[3/2] w-full overflow-hidden lg:aspect-auto lg:h-[665px]">
      {/* Background layers */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImages[activeIndex]})` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-linear-to-r from-black/55 via-black/25 to-black/20" />
      <div className="absolute inset-0 bg-linear-to-b from-black/20 via-transparent to-black/35" />

      {/* Brand logo */}
      <div className="site-shell absolute inset-x-0 bottom-[250px] z-20 sm:bottom-[310px] lg:bottom-[340px]">
        <Image src="/images/brand_logo_hero.png" alt="NanoHome" width={148} height={48} priority className="h-auto w-[110px] object-contain sm:w-[130px] lg:w-[156px]" />
      </div>

      {/* Title + CTA */}
      <div className="absolute inset-x-0 bottom-16 z-10 lg:bottom-20">
        <div className="site-shell">
          <h1 className="break-words text-3xl font-normal leading-9 text-white sm:text-4xl sm:leading-10 lg:text-[48px] lg:leading-[56px]">
            <span className="block">{t("titleLine1")}</span>
            <span className="block">{t("titleLine2")}</span>
          </h1>
          <button className="mt-8 rounded-none border border-white bg-white px-5 py-2.5 text-xs font-medium uppercase leading-4 tracking-wider text-[#111111] transition-colors hover:bg-[#111111] hover:text-white">
            {t("cta")}
          </button>
        </div>
      </div>

      {/* Hotspots with product cards */}
      {hotspotData.map((hotspot, index) => {
        const product = products[index] ?? hotspot.product;

        return (
        <div
          key={hotspot.position}
          ref={(el) => {
            hotspotRefs.current[index] = el;
          }}
          className={cn("absolute z-30 hidden sm:block", hotspot.position)}
        >
          {/* Concentric-circle hotspot button */}
          <button
            type="button"
            onClick={() => handleHotspotClick(index)}
            aria-label="Xem sản phẩm nổi bật"
            className="relative flex h-7 w-7 items-center justify-center rounded-full border border-white shadow-[0_0_12px_rgba(255,255,255,0.35)] transition-shadow duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.55)]"
          >
            {/* Ping ring — subtle radar pulse */}
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-ping rounded-full border border-white/25"
            />
            {/* Solid inner dot */}
            <span aria-hidden="true" className="relative h-4 w-4 rounded-full bg-white" />
          </button>

          {/* Product highlight card */}
          {openCard === index && (
            <div
        className={cn(
          "absolute w-[280px] max-w-[calc(100vw-2rem)]",
          cardPositionClasses[hotspot.cardPlacement],
        )}
            >
              <div className="overflow-hidden rounded-lg bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                {/* Close */}
                <button
                  type="button"
                  onClick={() => setOpenCard(null)}
                  aria-label="Đóng"
                  className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-[#666] shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-[#111]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                {/* Product thumbnail */}
                <div className="relative aspect-[4/5] w-full bg-white">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-contain p-4"
                    sizes="280px"
                  />
                </div>

                {/* Product info */}
                <div className="px-4 pb-4 pt-3">
                  <h3 className="line-clamp-2 text-sm leading-snug text-[#444]">
                    {product.name}
                  </h3>
                </div>
              </div>
            </div>
          )}
        </div>
        );
      })}

      {/* Slide navigation arrows */}
      <button
        type="button"
        onClick={goToPrevious}
        aria-label="Previous slide"
        className="absolute left-2 top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#111] sm:left-4 sm:flex lg:left-8"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        onClick={goToNext}
        aria-label="Next slide"
        className="absolute right-2 top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#111] sm:right-4 sm:flex lg:right-8"
      >
        <ChevronRight className="size-4" />
      </button>

      {/* Pagination dots */}
      <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5">
        {heroImages.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={`Go to slide ${index + 1}`}
            className={cn(
              "h-0.5 transition-all",
              activeIndex === index ? "w-10 bg-white" : "w-6 bg-white/20",
            )}
          />
        ))}
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 right-6 z-20 text-lg font-medium leading-none text-white lg:right-12">
        ↓
      </div>
    </section>
  );
}
