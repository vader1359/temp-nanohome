"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState, type MouseEvent } from "react";

import {
  ProductCard,
  type ProductCardLocale,
} from "@/components/products/product-card";
import type { ProductGridItem } from "@/components/products/product-grid-item";

export type ProductCardCarouselTelemetry =
  | Readonly<{ type: "rendered"; eligibleCount: number; skippedCount: number }>
  | Readonly<{ type: "scrolled"; direction: "previous" | "next"; fromIndex: number; toIndex: number }>
  | Readonly<{ type: "detail_clicked"; variantId: string; position: number }>
  | Readonly<{ type: "wishlist_toggled"; variantId: string; position: number; action: "added" | "removed" }>;

export type ProductCardCarouselProps = Readonly<{
  products: readonly ProductGridItem[];
  locale: ProductCardLocale;
  label: string;
  countLabel: string;
  previous: string;
  next: string;
  skippedCount?: number;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (product: ProductGridItem) => void;
  onTelemetry?: (event: ProductCardCarouselTelemetry) => void;
}>;

export function ProductCardCarousel({
  products,
  locale,
  label,
  countLabel,
  previous,
  next,
  skippedCount = 0,
  isFavorite,
  onToggleFavorite,
  onTelemetry,
}: ProductCardCarouselProps) {
  const visibleProducts = products.slice(0, 8);
  const productIds = visibleProducts.map((product) => product.id).join("\u0000");
  const headingId = useId();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const telemetryRef = useRef(onTelemetry);
  const lastScrollIndexRef = useRef(0);
  const [canScroll, setCanScroll] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    telemetryRef.current = onTelemetry;
  }, [onTelemetry]);

  useEffect(() => {
    if (visibleProducts.length === 0) return;
    telemetryRef.current?.({
      type: "rendered",
      eligibleCount: visibleProducts.length,
      skippedCount,
    });
  }, [productIds, skippedCount, visibleProducts.length]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const update = () => {
      const scrollable = visibleProducts.length > 1 && scroller.scrollWidth > scroller.clientWidth + 1;
      setCanScroll(scrollable);
      setAtStart(scroller.scrollLeft <= 1);
      setAtEnd(scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1);

      const card = scroller.firstElementChild;
      const cardWidth = card?.getBoundingClientRect().width ?? 0;
      const gap = Number.parseFloat(window.getComputedStyle(scroller).columnGap) || 12;
      const step = cardWidth + gap;
      if (step <= 0) return;

      const currentIndex = Math.max(0, Math.min(visibleProducts.length - 1, Math.round(scroller.scrollLeft / step)));
      const previousIndex = lastScrollIndexRef.current;
      if (currentIndex !== previousIndex) {
        telemetryRef.current?.({
          type: "scrolled",
          direction: currentIndex > previousIndex ? "next" : "previous",
          fromIndex: previousIndex,
          toIndex: currentIndex,
        });
        lastScrollIndexRef.current = currentIndex;
      }
    };

    update();
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(scroller);

    return () => {
      scroller.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [productIds, visibleProducts.length]);

  if (visibleProducts.length === 0) return null;

  const move = (direction: -1 | 1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const card = scroller.firstElementChild;
    const cardWidth = card?.getBoundingClientRect().width ?? 0;
    const gap = Number.parseFloat(window.getComputedStyle(scroller).columnGap) || 12;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollBy({ left: direction * (cardWidth + gap), behavior: reducedMotion ? "auto" : "smooth" });
  };

  const handleCardClick = (event: MouseEvent<HTMLDivElement>, product: ProductGridItem, position: number) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.closest("button") !== null || target.closest("a") === null) return;
    telemetryRef.current?.({ type: "detail_clicked", variantId: product.id, position });
  };

  return (
    <section
      aria-labelledby={headingId}
      className="relative"
      data-testid="chat-product-carousel"
      role="region"
    >
      <h2 className="sr-only" id={headingId}>{label}</h2>
      <p className="sr-only">{countLabel}</p>
      <div className="flex items-center gap-3">
        {canScroll ? (
          <button
            aria-label={previous}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-nh-border text-nh-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent disabled:opacity-40"
            disabled={atStart}
            onClick={() => move(-1)}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
        ) : null}
        <div
          aria-label={countLabel}
          className="flex min-w-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-1"
          ref={scrollerRef}
          role="group"
        >
          {visibleProducts.map((product, position) => (
            <div
              className="w-[78vw] max-w-[17rem] shrink-0 snap-start sm:w-48 sm:max-w-none"
              data-testid="chat-product-card"
              key={product.id}
              onClick={(event) => handleCardClick(event, product, position)}
            >
              <ProductCard
                fetchPriority="auto"
                isFavorite={isFavorite(product.id)}
                locale={locale}
                onToggleFavorite={() => {
                  onToggleFavorite(product);
                  telemetryRef.current?.({
                    type: "wishlist_toggled",
                    variantId: product.id,
                    position,
                    action: isFavorite(product.id) ? "removed" : "added",
                  });
                }}
                product={product}
              />
            </div>
          ))}
        </div>
        {canScroll ? (
          <button
            aria-label={next}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-nh-border text-nh-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent disabled:opacity-40"
            disabled={atEnd}
            onClick={() => move(1)}
            type="button"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
    </section>
  );
}
