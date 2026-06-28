"use client";

import { useState } from "react";
import Image from "next/image";
import { CarouselButtons } from "@/components/shared";
import { galleryImages as fallbackGalleryImages } from "./mock-data";

interface Section4GalleryProps {
  galleryImages?: string[];
}

export function Section4Gallery({ galleryImages = fallbackGalleryImages }: Section4GalleryProps) {
  const [start, setStart] = useState(0);
  const visible = 3;
  const maxStart = Math.max(0, galleryImages.length - visible);

  const canPrev = start > 0;
  const canNext = start < maxStart;

  return (
    <section className="bg-white px-4 py-12 sm:px-8 md:py-16">
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-8">
        {/* Title */}
        <h2 className="text-[24px] font-medium text-[#444]">Ảnh sản phẩm</h2>

        {/* Carousel strip + nav */}
        <div className="relative">
          <div className="grid grid-cols-1 gap-6 overflow-hidden md:grid-cols-3 md:pr-10">
            {galleryImages.slice(start, start + visible).map((src, i) => (
              <div
                key={start + i}
                className="relative aspect-[4/3] overflow-hidden rounded-md bg-[#F5F3F0]"
              >
                <Image
                  src={src}
                  alt={`Ảnh ${start + i + 1}`}
                  fill
                  sizes="(max-width:768px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>

          <CarouselButtons
            variant="warm"
            onPrev={() => setStart((s) => Math.max(0, s - 1))}
            onNext={() => setStart((s) => Math.min(maxStart, s + 1))}
            prevDisabled={!canPrev}
            nextDisabled={!canNext}
            className="absolute inset-x-2 top-1/2 -translate-y-1/2 justify-between sm:inset-x-0"
          />
        </div>
      </div>
    </section>
  );
}
