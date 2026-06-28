"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { FavoriteButton, StatusBadge } from "@/components/shared";

const SWATCHES = [
  "#111111",
  "#62616E",
  "#84818A",
  "#ABABAB",
  "#E8E8E8",
  "#4D2D1E",
  "#B39480",
  "#374067",
  "#3C69AD",
  "#676F57",
  "#3BB552",
  "#FCD240",
  "#ED9042",
  "#C23B4F",
];

export type ProductGridItem = {
  id: string;
  brand: string;
  name: string;
  subtitle: string;
  status: "ĐANG CÓ HÀNG" | "HẾT HÀNG" | "SALE";
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

function getStatusType(status: string): "sale" | "instock" | "outofstock" {
  if (status === "SALE") {
    return "sale";
  }

  if (status === "ĐANG CÓ HÀNG") {
    return "instock";
  }

  return "outofstock";
}

export function ProductGrid({ products, favorites, onToggleFavorite }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <section className="rounded border border-nh-border bg-white p-8 text-center text-sm text-nh-muted">
        Chưa có dữ liệu sản phẩm để hiển thị.
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-9 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => {
        const sale = product.status === "SALE";
        const statusType = getStatusType(product.status);

        return (
          <article
            className="group flex min-w-0 flex-col gap-6 bg-white p-4"
            key={product.id}
          >
            <div className="relative flex aspect-[4/3] w-full items-center justify-center bg-white p-4">
              <FavoriteButton
                active={favorites.has(product.id)}
                className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full border border-nh-border bg-white opacity-100 transition-opacity duration-200 group-hover:shadow-sm"
                onToggle={() => onToggleFavorite(product.id)}
                size="sm"
                variant="outline"
              />
              <StatusBadge
                className="absolute left-4 top-4 z-10 rounded-none px-1 py-0.5 text-center text-[12px] leading-4"
                label={product.status}
                type={statusType}
              />
              <Link
                aria-label={`Xem chi tiết ${product.name}`}
                className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[6px] transition-transform duration-300 group-hover:scale-[1.03]"
                href={product.href}
              >
                <Image
                  alt={product.name}
                  className="object-contain"
                  fill
                  sizes="(min-width: 1280px) 300px, (min-width: 640px) 45vw, 90vw"
                  src={product.imageUrl}
                />
              </Link>
            </div>

            <div className="flex flex-col items-start gap-2 text-left">
              <div className="text-[13px] font-medium leading-4 text-nh-ink">
                {product.brand}
              </div>
              <h3 className="text-[16px] font-normal leading-6 text-nh-ink">
                <Link className="transition-colors hover:text-nh-red" href={product.href}>
                  {product.name}
                </Link>
              </h3>
              <p className="text-[12px] font-medium leading-4 text-nh-muted">
                {product.subtitle}
              </p>
              <div className="mt-1 flex w-full items-center justify-between gap-1">
                {(product.swatches.length > 0 ? product.swatches : SWATCHES).slice(0, 14).map((swatch) => (
                  <span
                    className="size-3 shrink-0 border border-black"
                    key={swatch}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
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
