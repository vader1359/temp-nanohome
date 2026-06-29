"use client";

import Image from "next/image";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
  name: string;
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
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
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

export function ProductGrid({ products, favorites, onToggleFavorite }: ProductGridProps) {
  const t = useTranslations("Products");

  if (products.length === 0) {
    return (
      <section className="rounded border border-nh-border bg-white p-8 text-center text-sm text-nh-muted">
        {t("empty")}
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-9 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => {
        const sale = product.status === "sale";

        return (
            <article
              className="group flex min-w-0 flex-col gap-8 bg-white p-4"
              key={product.id}
            >
              <div className="relative flex aspect-[4/3] w-full items-end justify-center bg-white px-6 pb-8 pt-14">
                <button
                  className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center bg-transparent opacity-100 transition-opacity duration-200 sm:right-1.5 sm:top-1.5"
                  type="button"
                  onClick={() => onToggleFavorite(product.id)}
                  aria-label={t("favoriteAria", { name: product.name })}
                >
                  <Heart
                    strokeWidth={1.5}
                    className={cn(
                      "size-5 text-nh-ink transition-transform duration-200 group-hover:scale-110",
                      favorites.has(product.id) && "fill-nh-ink",
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
              <h3 className="line-clamp-2 text-[13px] font-normal leading-5 text-nh-ink sm:text-[16px] sm:leading-6">
                <Link className="transition-colors hover:text-nh-red" href={product.href}>
                  {product.name}
                </Link>
              </h3>
              <p className="text-[12px] font-normal leading-4 text-nh-muted">
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
      })}
    </section>
  );
}
