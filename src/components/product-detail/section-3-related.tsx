"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
            <span className="rounded-full bg-[#F5F3F0] px-4 py-1 text-[12px] font-medium text-[#666]">
              {collectionName}
            </span>
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

          <button
            type="button"
            aria-label="Sản phẩm trước"
            disabled={!canPrev}
            onClick={() => setStart((s) => Math.max(0, s - 1))}
            className="absolute left-2 top-[38%] flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF5EB] text-[#18181B] shadow-sm transition disabled:opacity-30 sm:left-0 sm:-translate-x-1/2"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="Sản phẩm tiếp theo"
            disabled={!canNext}
            onClick={() => setStart((s) => Math.min(maxStart, s + 1))}
            className="absolute right-2 top-[38%] flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF5EB] text-[#18181B] shadow-sm transition disabled:opacity-30 sm:right-0 sm:translate-x-1/2"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </section>
  );
}
