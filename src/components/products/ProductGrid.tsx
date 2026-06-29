"use client";

import Image from "next/image";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useWishlist, type WishlistItem } from "@/components/wishlist/wishlist-context";
import { cn } from "@/lib/utils";

/**
 * Stable, locale-agnostic status kinds. The user-facing label is rendered
 * via the `Products` i18n namespace, so the badge color comparison must use
 * these enum values — never Vietnamese literal strings.
 */
export type ProductStatusKind = "in_stock" | "out_of_stock" | "sale";

const STATUS_LABEL_KEY: Record<ProductStatusKind, "inStock" | "outOfStock" | "saleLabel"> = {
  in_stock: "inStock",
  out_of_stock: "outOfStock",
  sale: "saleLabel",
};

export type ProductGridItem = {
  id: string;
  brand: string;
  brandLogoUrl?: string | null;
  brandSlug?: string;
  category?: string;
  name: string;
  rooms?: readonly string[];
  subCategory?: string;
  subtitle: string;
  status: ProductStatusKind;
  imageUrl: string;
  href: string;
  oldPrice: string | null;
  discount: string | null;
  price: string;
  swatches: readonly string[];
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
  const animation = image.animate(
    [
      { opacity: 0.92, transform: "translate3d(0, 0, 0) scale(1) skew(0deg)" },
      { opacity: 0.72, transform: `translate3d(${deltaX * 0.45}px, ${deltaY * 0.35}px, 0) scale(0.72, 1.08) skew(-8deg)` },
      { opacity: 0.2, transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(0.08, 0.22) skew(-14deg)` },
    ],
    { duration: 720, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
  );

  animation.onfinish = () => image.remove();
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
    <section className="grid grid-cols-1 gap-9 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product, index) => {
        const sale = product.status === "sale";
        const priorityImage = index < 6;
        const favorited = hasItem(product.id);

        return (
            <article
              className="group flex aspect-[4/6] min-w-0 flex-col gap-4 overflow-hidden bg-white p-4"
              key={product.id}
              data-product-brand={product.brandSlug ?? product.brand}
              data-product-card=""
              data-product-category={product.category ?? ""}
              data-product-name={product.name}
              data-product-rooms={(product.rooms ?? []).join("|")}
              data-product-status={product.status}
              data-product-subcategory={product.subCategory ?? ""}
            >
              <div className="relative flex min-h-0 w-full flex-1 items-end justify-center bg-white px-8 pb-8 pt-14 sm:px-10 sm:pb-10 sm:pt-16">
                <button
                  className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center bg-transparent opacity-100 transition-opacity duration-200 sm:right-1.5 sm:top-1.5"
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
                  className="relative flex h-full w-full items-end justify-center overflow-hidden rounded-[6px] transition-transform duration-300 group-hover:scale-[1.03]"
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
                  <div className="relative h-4 w-[96px]">
                    <Image
                      alt={product.brand}
                      className="object-contain object-left grayscale contrast-200 brightness-0"
                      fill
                      sizes="96px"
                      src={product.brandLogoUrl}
                    />
                  </div>
                ) : (
                  <div className="text-[13px] font-medium leading-4 text-nh-ink">
                    {product.brand}
                  </div>
                )}
              <h3 className="line-clamp-2 min-h-10 text-balance text-[13px] font-normal leading-5 text-nh-ink sm:min-h-12 sm:text-[16px] sm:leading-6">
                <Link className="transition-colors hover:text-nh-red" href={product.href}>
                  {product.name}
                </Link>
              </h3>
              <p className="text-[12px] font-normal leading-4 text-nh-muted">
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
