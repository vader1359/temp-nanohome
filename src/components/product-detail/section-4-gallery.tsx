"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.css";
import { galleryImages as fallbackGalleryImages } from "./mock-data";

interface Section4GalleryProps {
  galleryImages?: string[];
}

export function Section4Gallery({ galleryImages = fallbackGalleryImages }: Section4GalleryProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const slides = useMemo(() => (galleryImages.length > 0 ? galleryImages : fallbackGalleryImages), [galleryImages]);
  const [sliderRef, slider] = useKeenSlider<HTMLDivElement>({
    initial: 0,
    mode: "free-snap",
    slideChanged(s) {
      setCurrentSlide(s.track.details.rel);
    },
    created() {
      setLoaded(true);
    },
    slides: {
      perView: 1.35,
      spacing: 16,
    },
    breakpoints: {
      "(min-width: 640px)": {
        slides: { perView: 2.25, spacing: 20 },
      },
      "(min-width: 1024px)": {
        slides: { perView: 3.15, spacing: 24 },
      },
    },
  });

  const maxIdx = slider.current?.track.details.maxIdx ?? 0;
  const canPrev = loaded && currentSlide > 0;
  const canNext = loaded && currentSlide < maxIdx;

  return (
    <section className="bg-white py-12 md:py-16">
      <div className="site-shell flex flex-col gap-8">
        <h2 className="text-[24px] font-medium text-[#444]">Ảnh sản phẩm</h2>

        <div className="relative overflow-hidden">
          <div ref={sliderRef} className="keen-slider overflow-visible">
            {slides.map((src, i) => {
              const isWide = i % 3 === 1;

              return (
                <div
                  key={`${src}-${i}`}
                  className="keen-slider__slide"
                  style={{ minWidth: isWide ? "38%" : "24%", maxWidth: isWide ? "38%" : "24%" }}
                >
                  <div className="relative h-[300px] overflow-hidden rounded-md bg-transparent sm:h-[360px] lg:h-[420px]">
                    <Image
                      src={src}
                      alt={`Ảnh ${i + 1}`}
                      fill
                      sizes="(max-width:640px) 78vw, (max-width:1024px) 48vw, 31vw"
                      className="object-cover"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Previous"
            disabled={!canPrev}
            onClick={() => slider.current?.prev()}
            className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#FFF5EB] text-[#18181B] shadow-sm transition disabled:opacity-30 sm:left-0 sm:-translate-x-1/2"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="Next"
            disabled={!canNext}
            onClick={() => slider.current?.next()}
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#FFF5EB] text-[#18181B] shadow-sm transition disabled:opacity-30 sm:right-0 sm:translate-x-1/2"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </section>
  );
}
