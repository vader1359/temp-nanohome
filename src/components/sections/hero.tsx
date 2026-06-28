"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { CarouselButtons, DarkCTAButton, PaginationDots } from "@/components/shared";
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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Hero() {
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
    setActiveIndex((current) => (current === 0 ? 2 : current - 1));
  };

  const goToNext = () => {
    setActiveIndex((current) => (current === 2 ? 0 : current + 1));
  };

  return (
    <section className="relative min-h-[620px] h-[calc(100svh-150px)] max-h-[886px] w-full overflow-hidden lg:h-[886px]">
      {/* Background layers */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/images/hero_bg.png)" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-linear-to-r from-black/55 via-black/25 to-black/20" />
      <div className="absolute inset-0 bg-linear-to-b from-black/20 via-transparent to-black/35" />

      {/* Brand logo */}
      <Image
        src="/images/brand_logo_hero.png"
        alt="NanoHome"
        width={148}
        height={48}
        priority
        className="absolute bottom-[272px] left-6 z-20 h-auto w-[120px] object-contain lg:left-12 lg:w-[164px]"
      />

      {/* Title + CTA */}
      <div className="absolute inset-x-0 bottom-[58px] z-10 px-6 sm:px-8 lg:px-12">
        <div className="max-w-[720px]">
          <h1 className="text-3xl font-normal leading-9 sm:text-4xl sm:leading-10 lg:text-[48px] lg:leading-[56px] text-white">
            <span className="block">{t("titleLine1")}</span>
            <span className="block">{t("titleLine2")}</span>
          </h1>
          <DarkCTAButton variant="dark" className="mt-6 leading-5">
            {t("cta")}
          </DarkCTAButton>
        </div>
      </div>

      {/* Hotspots with product cards */}
      {hotspotData.map((hotspot, index) => (
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
                <div className="relative h-[180px] w-full bg-[#f5f5f5]">
                  <Image
                    src={hotspot.product.image}
                    alt={hotspot.product.name}
                    fill
                    className="object-contain p-4"
                    sizes="280px"
                  />
                </div>

                {/* Product info */}
                <div className="px-4 pb-4 pt-3">
                  <p className="text-sm font-semibold leading-tight text-[#111]">
                    {hotspot.product.brand}
                  </p>
                  <h3 className="mt-1 truncate text-sm leading-snug text-[#444]">
                    {hotspot.product.name}
                  </h3>
                  <p className="mt-2 text-[15px] font-semibold text-[#111]">
                    {hotspot.product.price}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Slide navigation arrows */}
      <CarouselButtons
        onPrev={goToPrevious}
        onNext={goToNext}
        variant="light"
        className="absolute inset-x-4 top-1/2 z-20 -translate-y-1/2 justify-between sm:inset-x-6 lg:inset-x-12 [&_button]:size-6 [&_button]:bg-white"
      />

      {/* Pagination dots */}
      <PaginationDots
        count={3}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
        className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 gap-2.5 [&_button]:h-0.5 [&_button]:w-6 [&_button]:rounded-none [&_button]:bg-white/20 [&_button]:transition-all [&_.bg-nh-ink]:w-10 [&_.bg-nh-ink]:bg-white"
      />

      {/* Scroll indicator */}
      <div className="absolute bottom-10 right-6 z-20 text-lg font-medium leading-none text-white lg:right-12">
        ↓
      </div>
    </section>
  );
}
