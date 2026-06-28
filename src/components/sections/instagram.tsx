"use client";

import { useState } from "react";
import { ShoppingBag, Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.css";

const images = [
  "/images/insta_1.jpg",
  "/images/insta_2.jpg",
  "/images/insta_3.jpg",
  "/images/insta_4.jpg",
  "/images/insta_5.jpg",
  "/images/insta_6.jpg",
];

export function InstagramGallery() {
  const t = useTranslations("Instagram");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const [sliderRef, slider] = useKeenSlider<HTMLDivElement>({
    initial: 0,
    slideChanged(s) {
      setCurrentSlide(s.track.details.rel);
    },
    created() {
      setLoaded(true);
    },
    slides: {
      perView: 2,
      spacing: 16,
    },
    breakpoints: {
      "(min-width: 640px)": {
        slides: { perView: 3, spacing: 20 },
      },
      "(min-width: 1024px)": {
        slides: { perView: 4, spacing: 24 },
      },
    },
  });

  const maxIdx = slider?.current?.track.details.maxIdx ?? 0;
  const atStart = currentSlide === 0;
  const atEnd = currentSlide >= maxIdx;

  return (
    <section className="flex h-auto flex-col items-center gap-12 bg-white py-16 lg:py-20">
      <div className="flex max-w-[760px] flex-col items-center gap-3 px-6 text-center">
        <p className="text-[13px] font-medium uppercase tracking-wider text-[#666666] leading-5">
          {t("eyebrow")}
        </p>
        <h2 className="text-[32px] font-medium leading-10 text-[#111111]">
          {t("heading")}
        </h2>
      </div>

      <div className="relative w-full">
        <div ref={sliderRef} className="keen-slider !overflow-visible">
          {images.map((src, i) => (
            <div
              key={src}
              className="keen-slider__slide flex justify-center px-3 lg:px-4"
            >
              <a
                href="#"
                className="group relative h-[380px] w-full max-w-[340px] overflow-hidden bg-[#F5F5F5] sm:h-[400px] lg:h-[420px]"
              >
                <Image
                  src={src}
                  alt={`Instagram post ${i + 1}`}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <span className="absolute left-3 top-3 z-10 text-white drop-shadow-md">
                  <ShoppingBag className="h-4 w-4" />
                </span>
                <span className="absolute right-3 top-3 z-10 text-white drop-shadow-md">
                  <ImageIcon className="h-4 w-4" />
                </span>
              </a>
            </div>
          ))}
        </div>

        {loaded && slider.current && (
          <>
            <button
              onClick={() => slider.current?.prev()}
              disabled={atStart}
              aria-label="Previous"
              className={`absolute -left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#333] shadow-[0_2px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm transition-all duration-200 hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] sm:-left-5 sm:h-12 sm:w-12 lg:-left-6 ${
                atStart
                  ? "cursor-default opacity-0 pointer-events-none"
                  : "opacity-100"
              }`}
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => slider.current?.next()}
              disabled={atEnd}
              aria-label="Next"
              className={`absolute -right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#333] shadow-[0_2px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm transition-all duration-200 hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] sm:-right-5 sm:h-12 sm:w-12 lg:-right-6 ${
                atEnd
                  ? "cursor-default opacity-0 pointer-events-none"
                  : "opacity-100"
              }`}
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
