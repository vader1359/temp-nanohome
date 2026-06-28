"use client";

import { useState } from "react";
import { ShoppingBag, Image as ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.css";

import { CarouselButtons, SectionHeading } from "@/components/shared";

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
      <SectionHeading eyebrow={t("eyebrow")} title={t("heading")} className="max-w-[760px] gap-3 px-6" />

      <div className="relative w-full">
        <div ref={sliderRef} className="keen-slider overflow-hidden">
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
          <CarouselButtons
            onPrev={() => slider.current?.prev()}
            onNext={() => slider.current?.next()}
            prevDisabled={atStart}
            nextDisabled={atEnd}
            variant="light"
            className="absolute inset-x-1 top-1/2 z-20 -translate-y-1/2 justify-between sm:-inset-x-5 lg:-inset-x-6 [&_button]:h-11 [&_button]:w-11 [&_button]:text-[#333] [&_button]:shadow-[0_2px_12px_rgba(0,0,0,0.08)] [&_button]:backdrop-blur-sm [&_button]:duration-200 [&_button]:hover:bg-white [&_button]:hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] sm:[&_button]:h-12 sm:[&_button]:w-12"
          />
        )}
      </div>
    </section>
  );
}
