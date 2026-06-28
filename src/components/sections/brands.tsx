"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { cn } from "@/lib/utils";

type Brand =
  | { name: string; type: "text" }
  | { name: string; type: "image"; src: string; width: number };

const brands: Brand[] = [
  { name: "Cassina", type: "text" },
  { name: "B&B Italia", type: "text" },
  { name: "Maxalto", type: "image", src: "/images/maxalto_logo.png", width: 120 },
  { name: "Fritz Hansen", type: "text" },
  { name: "USM", type: "image", src: "/images/usm_logo.png", width: 96 },
  { name: "Vitra", type: "image", src: "/images/vitra_logo.png", width: 104 },
  { name: "Knoll", type: "image", src: "/images/knoll_logo.png", width: 104 },
  { name: "&Tradition", type: "text" },
  { name: "Flos", type: "text" },
];

function BrandLogo({ brand }: { brand: Brand }) {
  if (brand.type === "text") {
    return (
      <span className="whitespace-nowrap text-sm font-medium uppercase leading-5 tracking-wide text-[#111111]">
        {brand.name}
      </span>
    );
  }

  return (
    <span className="flex h-8 items-center justify-center">
      <Image
        src={brand.src}
        alt={brand.name}
        width={brand.width}
        height={32}
        className="h-7 w-auto object-contain grayscale contrast-200 brightness-0 dark:invert-0 md:h-8"
        style={{ objectFit: "contain" }}
      />
    </span>
  );
}

export function Brands() {
  const t = useTranslations("Brands");

  return (
    <section className="flex h-[240px] flex-col items-center gap-[30px] overflow-hidden bg-white pt-[60px] pb-[60px]">
      <p className="text-center text-sm font-medium uppercase leading-5 text-[#111111]">
        {t("eyebrow")}
      </p>

      <div
        className={cn(
          "flex w-max flex-nowrap items-center justify-center gap-14",
          "text-[#111111]",
        )}
      >
        {[...brands, ...brands].map((brand, index) => (
          <BrandLogo key={`${brand.name}-${index}`} brand={brand} />
        ))}
      </div>
    </section>
  );
}
