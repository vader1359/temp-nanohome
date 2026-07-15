"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useWishlist, type WishlistItem } from "@/components/wishlist/wishlist-context";
import type { ProductGridItem, ProductStatusKind } from "./product-grid-item";
import { cn } from "@/lib/utils";

export type { ProductGridItem, ProductStatusKind } from "./product-grid-item";

const STATUS_LABEL_KEY: Record<ProductStatusKind, "inStock" | "outOfStock" | "saleLabel"> = {
  in_stock: "inStock",
  out_of_stock: "outOfStock",
  sale: "saleLabel",
};

interface ProductGridProps {
  products: readonly ProductGridItem[];
  gridClassName?: string;
}

function getStatusClass(status: ProductStatusKind) {
  if (status === "sale") {
    return "bg-[#FBECEC] text-nh-red";
  }

  if (status === "in_stock") {
    return "bg-[#EAF7EF] text-nh-green";
  }

  return "bg-[#E6E6E6] text-nh-ink";
}

function toWishlistItem(product: ProductGridItem): WishlistItem {
  return {
    id: product.id,
    name: product.name,
    category: product.subtitle,
    price: product.price,
    originalPrice: product.oldPrice,
    discount: product.discount,
    badge: product.status === "sale" ? "Sale" : product.status === "in_stock" ? "Còn hàng" : "Hết hàng",
    badgeTone: product.status === "sale" ? "sale" : product.status === "in_stock" ? "stock" : "out",
    image: product.imageUrl,
    href: product.href,
  };
}

function getVisibleWishlistTarget(): HTMLElement | null {
  const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-wishlist-target]"));
  return targets.find((target) => {
    const rect = target.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }) ?? null;
}

function playAddToWishlistAnimation(origin: HTMLElement, onComplete: () => void) {
  const target = getVisibleWishlistTarget();
  if (!target) return null;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    return null;
  }

  const originRect = origin.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = `${originRect.left}px`;
  wrapper.style.top = `${originRect.top}px`;
  wrapper.style.width = `${originRect.width}px`;
  wrapper.style.height = `${originRect.height}px`;
  wrapper.style.pointerEvents = "none";
  wrapper.style.zIndex = "10000";

  wrapper.setAttribute("aria-hidden", "true");
  wrapper.setAttribute("inert", "");
  if ("inert" in wrapper) {
    (wrapper as unknown as { inert: boolean }).inert = true;
  }

  // Clone the whole source card DOM node via cloneNode(true)
  const clone = origin.cloneNode(true) as HTMLElement;

  // Sanitize clone IDs if any
  if (clone.id) {
    clone.removeAttribute("id");
  }
  clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));

  clone.setAttribute("tabindex", "-1");
  if ("tabIndex" in clone) {
    clone.tabIndex = -1;
  }
  clone.querySelectorAll("*").forEach((el) => {
    el.setAttribute("tabindex", "-1");
    if ("tabIndex" in el) {
      (el as unknown as { tabIndex: number }).tabIndex = -1;
    }
  });

  // Make it visually self-contained
  clone.style.backgroundColor = "white";
  clone.style.overflow = "hidden";
  clone.style.boxShadow = "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)";
  clone.style.transformOrigin = "center center";
  clone.style.pointerEvents = "none";
  clone.style.width = "100%";
  clone.style.height = "100%";
  clone.style.margin = "0";
  clone.style.willChange = "transform, opacity";

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  const deltaX = targetRect.left + targetRect.width / 2 - (originRect.left + originRect.width / 2);
  const deltaY = targetRect.top + targetRect.height / 2 - (originRect.top + originRect.height / 2);

  const focusAnim = clone.animate(
    [
      { transform: "scale(1) translateY(0)" },
      { transform: "scale(1.05) translateY(-8px)", offset: 0.5 },
      { transform: "scale(1.02) translateY(-4px)" }
    ],
    { duration: 400, easing: "cubic-bezier(0.2, 0, 0.4, 1)", fill: "forwards" }
  );

  let flightInnerAnim: Animation | null = null;
  let flightWrapperAnim: Animation | null = null;
  let targetAnim: Animation | null = null;
  let isCleanedUp = false;

  const cancelAll = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    wrapper.remove();
    focusAnim.cancel();
    if (flightWrapperAnim) flightWrapperAnim.cancel();
    if (flightInnerAnim) flightInnerAnim.cancel();
    if (targetAnim) targetAnim.cancel();
  };

  focusAnim.onfinish = () => {
    if (isCleanedUp) return;
    const flightDuration = 700;

    flightWrapperAnim = wrapper.animate(
      [
        { transform: "translate3d(0, 0, 0)" },
        { transform: `translate3d(${deltaX}px, 0, 0)` }
      ],
      { duration: flightDuration, easing: "cubic-bezier(0.25, 1, 0.5, 1)", fill: "forwards" }
    );

    flightInnerAnim = clone.animate(
      [
        { transform: "translate3d(0, 0, 0) scale(1.02)", opacity: 1 },
        {
          transform: `translate3d(0, ${deltaY * 0.5}px, 0) scale(0.4) rotate(${deltaX > 0 ? 15 : -15}deg)`,
          opacity: 0.9,
          offset: 0.6
        },
        { transform: `translate3d(0, ${deltaY}px, 0) scale(0.1) rotate(0deg)`, opacity: 0 }
      ],
      { duration: flightDuration, easing: "cubic-bezier(0.5, 0, 0.75, 0)", fill: "forwards" }
    );

    flightInnerAnim.onfinish = () => {
      if (isCleanedUp) return;
      cleanup();
    };

    function cleanup() {
      wrapper.remove();

      if (target) {
        targetAnim = target.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.25) rotate(-5deg)", offset: 0.4 },
            { transform: "scale(0.9) rotate(3deg)", offset: 0.7 },
            { transform: "scale(1) rotate(0deg)" }
          ],
          { duration: 450, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
        );

        targetAnim.onfinish = () => {
          if (isCleanedUp) return;
          isCleanedUp = true;
          onComplete();
        };
      } else {
        isCleanedUp = true;
        onComplete();
      }
    }
  };

  return cancelAll;
}

export function ProductGrid({ products, gridClassName }: ProductGridProps) {
  const t = useTranslations("Products");
  const { hasItem, toggleItem } = useWishlist();
  const currentAnimationRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (currentAnimationRef.current) {
        currentAnimationRef.current();
      }
    };
  }, []);

  if (products.length === 0) {
    return (
      <section className="rounded border border-nh-border bg-white p-8 text-center text-sm text-nh-muted">
        {t("empty")}
      </section>
    );
  }

  return (
    <section className={cn("grid grid-cols-2 gap-4 sm:gap-9 xl:grid-cols-3", gridClassName)}>
      {products.map((product, index) => {
        const priorityImage = index < 6;
        const favorited = hasItem(product.id);

        return (
            <article
              className="group flex aspect-[3/6] min-w-0 flex-col gap-3 overflow-hidden bg-white p-2 sm:aspect-[3/5] sm:gap-4 sm:p-4"
              key={product.id}
              data-product-brand={product.brandSlug ?? product.brand}
              data-product-card=""
              data-product-category={product.category ?? ""}
              data-product-name={product.name}
              data-product-rooms={(product.rooms ?? []).join("|")}
               data-product-status={product.status}
               data-product-subcategory={product.subCategory ?? ""}
               data-search-result={product.searchVariantId === undefined ? undefined : "product"}
               data-variant-id={product.searchVariantId}
            >
              <div className="relative flex min-h-0 w-full flex-1 items-end justify-center bg-white px-2 pb-2 pt-8 sm:px-5 sm:pb-9 sm:pt-16">
                <button
                  className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center bg-transparent opacity-100 transition-opacity duration-200 sm:right-1.5 sm:top-1.5 sm:h-5 sm:w-5"
                  type="button"
                  onClick={(event) => {
                    const card = event.currentTarget.closest<HTMLElement>("[data-product-card]");
                    if (!favorited) {
                      if (currentAnimationRef.current) {
                        currentAnimationRef.current();
                        currentAnimationRef.current = null;
                      }
                      if (card) {
                        const animCleanup = playAddToWishlistAnimation(card, () => {
                          if (currentAnimationRef.current === animCleanup) {
                            currentAnimationRef.current = null;
                          }
                        });
                        if (animCleanup) {
                          currentAnimationRef.current = animCleanup;
                        }
                      }
                    }
                    toggleItem(toWishlistItem(product));
                  }}
                  aria-label={t("favoriteAria", { name: product.name })}
                >
                  <Heart
                    strokeWidth={1.5}
                    className={cn(
                      "size-4 text-nh-ink transition-transform duration-200 group-hover:scale-110 sm:size-5",
                      favorited && "fill-nh-red text-nh-red",
                    )}
                  />
                </button>
                <span
                  className={cn(
                    "absolute left-1 top-1 z-10 px-1.5 py-0.5 text-center text-[9px] font-semibold uppercase leading-3 sm:left-1.5 sm:top-1.5 sm:px-2 sm:py-1 sm:text-[12px] sm:leading-4",
                    getStatusClass(product.status),
                  )}
                >
                  {t(STATUS_LABEL_KEY[product.status])}
                </span>
                <Link
                  aria-label={t("viewDetailAria", { name: product.name })}
                  className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[6px] transition-transform duration-300 group-hover:scale-[1.03]"
                  href={product.href}
                  prefetch={priorityImage}
                  data-product-image-frame
                >
                  <Image
                    alt={product.name}
                    className={cn(
                      "object-contain object-bottom",
                      product.status === "out_of_stock" &&
                        "opacity-75 grayscale-[35%] transition-opacity duration-300 group-hover:opacity-85",
                    )}
                    fill
                    priority={priorityImage}
                    sizes="(min-width: 1280px) 360px, (min-width: 640px) 45vw, 90vw"
                    src={product.imageUrl}
                  />
                </Link>
              </div>

              <div className="mx-1 flex flex-col items-start gap-2 text-left sm:mx-1.5">
                {product.brandLogoUrl ? (() => {
                  const isUsm = product.brand.toLowerCase() === "usm";
                  const isVolta = product.brand.toLowerCase() === "volta";
                  const logoUrl = isUsm ? "/images/usm_logo.png" : product.brandLogoUrl;

                  return (
                    <div className="relative h-[14px] w-[90px] sm:h-[21px] sm:w-[126px]">
                      <Image
                        alt={product.brand}
                        className={cn(
                          "object-contain object-left",
                          !(isUsm || isVolta) && "grayscale contrast-200 brightness-0"
                        )}
                        fill
                        unoptimized
                        sizes="126px"
                        src={logoUrl}
                      />
                    </div>
                  );
                })() : (
                  <div className="text-[9px] font-medium leading-3 text-nh-ink sm:text-[12px] sm:leading-4">
                    {product.brand}
                  </div>
                )}
              <h3 className="line-clamp-2 text-[11px] font-normal min-h-8 text-balance leading-4 text-nh-ink sm:min-h-9 sm:text-[12px] sm:leading-[18px]">
                <Link className="transition-colors hover:text-nh-red" href={product.href}>
                  {product.name}
                </Link>
              </h3>
              <p className="text-[9px] font-normal leading-4 text-nh-muted sm:text-[12px]">
                {product.subtitle}
              </p>
              <div className="mt-2 flex flex-col items-start gap-1 text-left">
                {product.status === "sale" ? (
                  <>
                    <div className="flex items-center gap-2">
                      {product.oldPrice && (
                        <span className="text-[11px] text-nh-muted line-through">
                          {product.oldPrice}
                        </span>
                      )}
                      <span className="rounded bg-nh-red px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {product.discount ? product.discount : "SALE"}
                      </span>
                    </div>
                    <span className="text-[13px] font-semibold leading-5 text-nh-ink">
                      {product.price}
                    </span>
                  </>
                ) : (
                  <span className="text-[13px] font-semibold leading-5 text-nh-ink">
                    {product.price}
                  </span>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
