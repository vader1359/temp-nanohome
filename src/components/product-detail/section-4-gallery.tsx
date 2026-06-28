"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { galleryImages } from "./mock-data";

export function Section4Gallery() {
  const [start, setStart] = useState(0);
  const visible = 3;
  const maxStart = Math.max(0, galleryImages.length - visible);

  const canPrev = start > 0;
  const canNext = start < maxStart;

  return (
    <section className="bg-white px-8 py-16">
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-8">
        {/* Title */}
        <h2 className="text-[24px] font-medium text-[#444]">Ảnh sản phẩm</h2>

        {/* Carousel strip + nav */}
        <div className="relative">
          <div className="grid grid-cols-1 gap-6 overflow-hidden pr-10 md:grid-cols-3">
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

          <button
            type="button"
            aria-label="Previous"
            disabled={!canPrev}
            onClick={() => setStart((s) => Math.max(0, s - 1))}
            className="absolute left-0 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#FFF5EB] text-[#18181B] shadow-sm transition disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="Next"
            disabled={!canNext}
            onClick={() => setStart((s) => Math.min(maxStart, s + 1))}
            className="absolute right-0 top-1/2 flex h-9 w-9 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#FFF5EB] text-[#18181B] shadow-sm transition disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </section>
  );
}