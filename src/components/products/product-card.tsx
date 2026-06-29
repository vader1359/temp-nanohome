"use client";

import Image from "next/image";
import { Heart } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { type ProductGridItem } from "@/components/products/ProductGrid";

export type { ProductGridItem } from "@/components/products/ProductGrid";

function getStatusClass(status: string) {
  if (status === "SALE") {
    return "bg-nh-red text-white";
  }

  if (status === "CÓ SẴN") {
    return "bg-nh-green text-white";
  }

  return "border border-nh-border bg-white text-nh-muted";
}

export function ProductCard({
  product,
  isFavorite,
  onToggleFavorite,
}: Readonly<{
  product: ProductGridItem;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}>) {
  const sale = product.status === "SALE";

  return (
    <article className="group flex min-w-0 flex-col gap-4 bg-white p-2 sm:gap-6 sm:p-4">
      <div className="relative flex aspect-[4/5] w-full items-end justify-center bg-white px-2 pb-4 pt-8 sm:px-8 sm:pb-10 sm:pt-14">
        <button
          className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center bg-transparent opacity-100 transition-opacity duration-200 sm:right-1.5 sm:top-1.5"
          type="button"
          onClick={() => onToggleFavorite(product.id)}
          aria-label={`Yêu thích ${product.name}`}
        >
          <Heart
            className={cn(
              "size-4 text-nh-ink transition-transform duration-200 group-hover:scale-110",
              isFavorite && "fill-nh-ink",
            )}
          />
        </button>
        <span
          className={cn(
            "absolute left-1 top-1 z-10 px-1.5 py-0.5 text-center text-[9px] font-medium leading-3 sm:left-1.5 sm:top-1.5 sm:px-3 sm:py-1 sm:text-[12px] sm:leading-4",
            getStatusClass(product.status),
          )}
        >
          {product.status}
        </span>
        <Link
          aria-label={`Xem chi tiết ${product.name}`}
          className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[6px] transition-transform duration-300 group-hover:scale-[1.03]"
          href={product.href}
        >
          <Image
            alt={product.name}
            className="object-contain object-bottom"
            fill
            sizes="(min-width: 1280px) 300px, (min-width: 640px) 45vw, 90vw"
            src={product.imageUrl}
          />
        </Link>
      </div>

      <div className="flex flex-col items-start gap-2 px-3 pb-3 text-left sm:px-4 sm:pb-4">
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
        <h3 className="line-clamp-2 text-[12px] font-light leading-4 text-nh-ink sm:text-[16px] sm:leading-6">
          <Link className="transition-colors hover:text-nh-red" href={product.href}>
            {product.name}
          </Link>
        </h3>
        <p className="text-[12px] font-medium leading-4 text-nh-muted">
          {product.subtitle}
        </p>
        <div className="mt-2 flex flex-col items-center gap-1">
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
}
