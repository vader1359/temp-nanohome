"use client";

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

function playAddToWishlistAnimation(imageSrc: string, origin: HTMLElement) {
  const target = getVisibleWishlistTarget();
  if (!target) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    target.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.1)" },
        { transform: "scale(1)" },
      ],
      { duration: 260, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );
    return;
  }

  const originRect = origin.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const image = document.createElement("img");
  image.src = imageSrc;
  image.alt = "";
  image.style.position = "fixed";
  image.style.left = `${originRect.left}px`;
  image.style.top = `${originRect.top}px`;
  image.style.width = `${originRect.width}px`;
  image.style.height = `${originRect.height}px`;
  image.style.objectFit = "contain";
  image.style.pointerEvents = "none";
  image.style.zIndex = "10000";
  document.body.appendChild(image);

  const deltaX = targetRect.left + targetRect.width / 2 - (originRect.left + originRect.width / 2);
  const deltaY = targetRect.top + targetRect.height / 2 - (originRect.top + originRect.height / 2);
  const isUpward = deltaY < 0;

  const animation = image.animate(
    [
      {
        opacity: 1,
        transform: "translate3d(0, 0, 0) scale(1)",
        clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)"
      },
      {
        opacity: 0.94,
        transform: `translate3d(${deltaX * 0.22}px, ${deltaY * 0.16}px, 0) scale(0.78, 0.88)`,
        clipPath: isUpward ? "polygon(30% 0%, 70% 0%, 92% 100%, 8% 100%)" : "polygon(8% 0%, 92% 0%, 70% 100%, 30% 100%)"
      },
      {
        opacity: 0.8,
        transform: `translate3d(${deltaX * 0.52}px, ${deltaY * 0.44}px, 0) scale(0.5, 0.68)`,
        clipPath: isUpward ? "polygon(45% 0%, 55% 0%, 75% 100%, 25% 100%)" : "polygon(25% 0%, 75% 0%, 55% 100%, 45% 100%)"
      },
      {
        opacity: 0.45,
        transform: `translate3d(${deltaX * 0.82}px, ${deltaY * 0.75}px, 0) scale(0.25, 0.42)`,
        clipPath: isUpward ? "polygon(48% 0%, 52% 0%, 58% 100%, 42% 100%)" : "polygon(42% 0%, 58% 0%, 52% 100%, 48% 100%)"
      },
      {
        opacity: 0,
        transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(0.08, 0.16)`,
        clipPath: "polygon(50% 0%, 50% 0%, 50% 100%, 50% 100%)"
      },
    ],
    { duration: 650, easing: "cubic-bezier(0.25, 0.8, 0.25, 1)", fill: "forwards" },
  );

  animation.onfinish = () => {
    image.remove();
    target.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.1)" },
        { transform: "scale(1)" },
      ],
      { duration: 260, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );
  };
  animation.oncancel = () => image.remove();
}

export function ProductGrid({ products }: ProductGridProps) {
  const t = useTranslations("Products");
  const { hasItem, toggleItem } = useWishlist();

  if (products.length === 0) {
    return (
      <section className="rounded border border-nh-border bg-white p-8 text-center text-sm text-nh-muted">
        {t("empty")}
      </section>
    );
  }

  return (
    <section className="grid grid-cols-2 gap-4 sm:gap-9 xl:grid-cols-3">
      {products.map((product, index) => {
        const sale = product.status === "sale";
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
                  className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center bg-transparent opacity-100 transition-opacity duration-200 sm:right-1.5 sm:top-1.5"
                  type="button"
                  onClick={(event) => {
                    const card = event.currentTarget.closest<HTMLElement>("[data-product-card]");
                    const imageFrame = card?.querySelector<HTMLElement>("[data-product-image-frame]");
                    if (!favorited) playAddToWishlistAnimation(product.imageUrl, imageFrame ?? event.currentTarget);
                    toggleItem(toWishlistItem(product));
                  }}
                  aria-label={t("favoriteAria", { name: product.name })}
                >
                  <Heart
                    strokeWidth={1.5}
                    className={cn(
                      "size-5 text-nh-ink transition-transform duration-200 group-hover:scale-110",
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
                    className="object-contain object-bottom"
                    fill
                    priority={priorityImage}
                    sizes="(min-width: 1280px) 360px, (min-width: 640px) 45vw, 90vw"
                    src={product.imageUrl}
                  />
                </Link>
              </div>

              <div className="mx-1 flex flex-col items-start gap-2 text-left sm:mx-1.5">
                {product.brandLogoUrl ? (
                  <div className="relative h-3 w-[76px] sm:h-3.5 sm:w-[84px]">
                    <Image
                      alt={product.brand}
                      className="object-contain object-left grayscale contrast-200 brightness-0"
                      fill
                      sizes="84px"
                      src={product.brandLogoUrl}
                    />
                  </div>
                ) : (
                  <div className="text-[11px] font-medium leading-3 text-nh-ink sm:text-[12px] sm:leading-4">
                    {product.brand}
                  </div>
                )}
              <h3 className="line-clamp-2 text-[13px] font-normal min-h-8 text-balance leading-4 text-nh-ink sm:min-h-9 sm:text-[12px] sm:leading-[18px]">
                <Link className="transition-colors hover:text-nh-red" href={product.href}>
                  {product.name}
                </Link>
              </h3>
              <p className="text-[11px] font-normal leading-4 text-nh-muted sm:text-[12px]">
                {product.subtitle}
              </p>
              <div className="mt-2 flex flex-col items-start gap-1 text-left">
                {sale && product.oldPrice ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-normal leading-4 text-nh-muted line-through">
                      {product.oldPrice}
                    </span>
                    {product.discount ? (
                      <span className="bg-nh-red px-1.5 py-0.5 text-[12px] font-medium leading-4 text-white">
                        {product.discount}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <span className="text-[15px] font-semibold leading-5 text-nh-ink">
                  {product.price}
                </span>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
