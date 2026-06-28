"use client";

import { useState } from "react";
import { CarouselButtons, Chip } from "@/components/shared";
import { ProductCard } from "./product-card";
import { relatedSet as fallbackRelatedSet, type RelatedProduct } from "./mock-data";

interface Section3RelatedProps {
  products?: RelatedProduct[];
  collectionName?: string;
}

export function Section3Related({ products = fallbackRelatedSet, collectionName = "Bộ sưu tập" }: Section3RelatedProps) {
  const [start, setStart] = useState(0);
  const visible = 4;
  const maxStart = Math.max(0, products.length - visible);

  const canPrev = start > 0;
  const canNext = start < maxStart;
  const items = products.slice(start, start + visible);

  return (
    <section className="bg-white px-4 py-12 sm:px-8 md:py-16">
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col items-start gap-3">
            <h2 className="text-[24px] font-medium text-[#444]">Sản phẩm cùng bộ</h2>
            <Chip variant="soft" className="px-4 text-[#666]">
              {collectionName}
            </Chip>
          </div>
          <a href="#" className="mt-1 text-[14px] font-normal text-[#111] hover:underline">
            Xem tất cả
          </a>
        </div>

        {/* Carousel */}
        <div className="relative">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.name} p={p} />
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
