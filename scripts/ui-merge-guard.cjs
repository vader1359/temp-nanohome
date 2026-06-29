#!/usr/bin/env node

const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const checks = [
  {
    file: "src/components/sections/hero.tsx",
    markers: ["aspect-[3/2]", "lg:aspect-auto", "sm:flex"],
  },
  {
    file: "src/components/sections/instagram.tsx",
    markers: ["perView: 1", "!px-24 lg:!px-0", "currentSlide", "slider.current?.moveToIdx"],
  },
  {
    file: "src/components/sections/products-grid.tsx",
    markers: ["useKeenSlider", "block sm:hidden", "sm:grid", "slider.current?.moveToIdx"],
  },
  {
    file: "src/components/sections/rooms.tsx",
    markers: ["useKeenSlider", "block md:hidden", "md:grid", "slider.current?.moveToIdx"],
  },
  {
    file: "src/components/sections/about.tsx",
    markers: ["border-t", "md:border-l", "relative h-full overflow-hidden", "aspect-[1360/615]"],
  },
  {
    file: "src/components/sections/brands.tsx",
    markers: ["overflow-x-auto", "motion-safe:animate-[brand-marquee_50s_linear_infinite]"],
    absent: ["flex flex-col items-center gap-[30px] overflow-x-auto"],
  },
  {
    file: "src/components/sections/featured-products.tsx",
    markers: ["useKeenSlider", "block md:hidden", "md:flex", "grid w-full grid-cols-1 gap-6"],
  },
  {
    file: "src/components/sections/footer.tsx",
    markers: ["col-span-2 grid grid-cols-1", "lg:contents"],
    absent: ["col-span-2 grid grid-cols-2"],
  },
  {
    file: "src/components/header.tsx",
    markers: ["site-shell py-4", "font-normal uppercase"],
  },
  {
    file: "src/components/product-detail/section-1-hero.tsx",
    markers: ["aspect-square h-auto min-h-full rounded-none px-0"],
  },
  {
    file: "src/components/product-detail/section-4-gallery.tsx",
    markers: ["slides.map", "object-cover"],
    absent: ["rounded-md"],
  },
  {
    file: "src/components/product-detail/section-5-benefits.tsx",
    markers: ["grid-cols-1", "md:grid-cols-2", "xl:grid-cols-4"],
    absent: ["md:flex-row"],
  },
  {
    file: "src/app/[locale]/products/[slug]/page.tsx",
    markers: ["getVariantProducts({", "excludeId: variant.id", "pageSize: 8", "getVariantPackshotUrl"],
  },
  {
    file: "src/app/[locale]/products/page.tsx",
    markers: ["function titleizeSlug", "filter_sub_category", "sub_category"],
    absent: ["resolveFinishLabel"],
  },
  {
    file: "src/components/products/ProductGrid.tsx",
    markers: [
      "items-end justify-center",
      "object-contain object-bottom",
      "strokeWidth={1.5}",
      "size-5 text-nh-ink",
      "mx-1 flex flex-col",
      "line-clamp-2 text-[13px] font-normal",
      "product.brandLogoUrl",
      "bg-[#FBECEC] text-nh-red",
      "bg-[#EAF7EF] text-nh-green",
    ],
    absent: ["SWATCHES", "rounded-full border", "font-medium leading-6 text-nh-ink"],
  },
  {
    file: "src/components/products/product-card.tsx",
    markers: ["font-semibold uppercase", "bg-[#FBECEC] text-nh-red", "bg-[#EAF7EF] text-nh-green"],
  },
  {
    file: "src/components/products/catalog-header.tsx",
    markers: ["font-normal uppercase"],
  },
  {
    file: "src/components/shared/shared-header.tsx",
    markers: ["font-normal uppercase"],
  },
  {
    file: "src/lib/queries/products.ts",
    markers: ["filter_sub_category", "brand_cldr_logo", "media_lifestyle_1", "media_closeup"],
  },
];

const failures = [];

for (const check of checks) {
  const content = read(check.file);

  for (const marker of check.markers ?? []) {
    if (!content.includes(marker)) {
      failures.push(`${check.file}: missing marker ${JSON.stringify(marker)}`);
    }
  }

  for (const marker of check.absent ?? []) {
    if (content.includes(marker)) {
      failures.push(`${check.file}: forbidden old marker still present ${JSON.stringify(marker)}`);
    }
  }
}

if (failures.length > 0) {
  console.error("UI merge guard failed. Protected Pointa UI fixes may have been overwritten:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`UI merge guard passed (${checks.length} files checked).`);
