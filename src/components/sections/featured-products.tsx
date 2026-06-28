"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

const swatches = [
  "#111111",
  "#62616e",
  "#84818a",
  "#ababab",
  "#e8e8e8",
  "#4d2d1e",
  "#b39480",
  "#374067",
  "#3c69ad",
  "#676f57",
  "#3bb552",
  "#fcd240",
  "#ed9042",
  "#c23b4f",
] as const;

const featuredProducts = [
  {
    productImage: "/images/feat_egg_main.png",
    lifestyleImage: "/images/feat_egg_1.png",
    lifestyleImage2: "/images/feat_egg_2.png",
    nameKey: "eggName",
    brandKey: "eggBrand",
    categoryKey: "eggCategory",
    reverse: false,
  },
  {
    productImage: "/images/feat_husk.png",
    lifestyleImage: "/images/featured-living-room.png",
    lifestyleImage2: "/images/feat_husk_2.png",
    nameKey: "huskName",
    brandKey: "huskBrand",
    categoryKey: "huskCategory",
    reverse: true,
  },
] as const;

function FeaturedProductCard({
  image,
  name,
  brand,
  category,
}: {
  image: string;
  name: string;
  brand: string;
  category: string;
}) {
  const t = useTranslations("Featured");

  return (
    <article className="relative flex w-full flex-col gap-4 bg-white p-3 sm:aspect-[340/492] sm:gap-6 sm:p-4">
      <button
        type="button"
        aria-label={`Add ${name} to favorites`}
        className="absolute right-4 top-4 z-10 text-[#111] transition-opacity hover:opacity-70"
      >
        <Heart className="size-5 stroke-[1.25]" />
      </button>

      <span className="absolute left-4 top-4 z-10 bg-[#00A63E] px-1 py-0.5 text-xs font-medium leading-4 text-white">
        {t("inStock")}
      </span>

      <div className="relative flex aspect-square w-full shrink-0 items-center justify-center p-4">
        <Image
          src={image}
          alt={name}
          fill
          sizes="(min-width: 768px) 436px, calc(100vw - 64px)"
          className="rounded-md object-contain p-4"
        />
      </div>

      <div className="flex flex-col shrink-0 gap-2 sm:h-[138px]">
        <div className="flex h-6 items-start">
          <span className="text-base font-semibold uppercase leading-5 tracking-[0.02em] text-[#111]">
            {brand}
          </span>
        </div>
        <h3 className="truncate text-base font-normal leading-6 text-[#111]">
          {name}
        </h3>
        <p className="text-xs font-medium leading-4 text-[#666]">{category}</p>
        <div
          className="grid w-full gap-1"
          style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}
          aria-hidden="true"
        >
          {swatches.map((color) => (
            <span
              key={color}
              className="h-3.5 w-full border border-black"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <p className="text-[15px] font-semibold leading-5 text-[#111]">
          {t("price")}
        </p>
      </div>
    </article>
  );
}

export function FeaturedProducts() {
  const t = useTranslations("Featured");

  return (
    <section
      data-section="featured-products"
      className="flex flex-col items-center gap-10 bg-white py-[60px] sm:gap-[60px]"
    >
      <div className="flex h-[90.4px] w-full max-w-[802.43px] flex-col items-center gap-4 px-6 text-center">
        <p className="w-full text-sm font-medium uppercase leading-5 text-[#444]">
          {t("eyebrow")}
        </p>
        <h2 className="flex h-[54.4px] w-full items-center justify-center text-[32px] font-medium leading-10 text-[#111]">
          {t("heading")}
        </h2>
      </div>

      <div className="flex w-full flex-col gap-10 sm:gap-[60px]">
        {featuredProducts.map((product) => {
          const lifestyle = (
            <div className="relative h-[360px] w-full overflow-hidden sm:h-[480px] md:h-[810px] md:w-[660px]">
              <Image
                src={product.lifestyleImage}
                alt=""
                fill
                sizes="(min-width: 768px) 660px, 100vw"
                className="object-cover"
              />
              <Image
                src={product.lifestyleImage2}
                alt=""
                fill
                sizes="(min-width: 768px) 660px, 100vw"
                className="absolute inset-0 object-cover"
              />
            </div>
          );

          const card = (
            <div className="flex h-auto w-full items-center justify-center md:h-[810px] md:w-[660px] md:p-20">
              <div className="w-full max-w-[500px]">
                <FeaturedProductCard
                  image={product.productImage}
                  name={t(product.nameKey)}
                  brand={t(product.brandKey)}
                  category={t(product.categoryKey)}
                />
              </div>
            </div>
          );

          return (
            <div
              key={product.nameKey}
              className="flex w-full flex-col items-center justify-between gap-6 overflow-hidden px-6 md:h-[810px] md:flex-row md:px-12"
            >
              {product.reverse ? card : lifestyle}
              {product.reverse ? lifestyle : card}
            </div>
          );
        })}
      </div>
    </section>
  );
}
