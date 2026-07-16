"use client";

import type { HomepageCmsSection } from "@/lib/queries/homepage-cms";
import { HeroCarousel, type HotspotProduct } from "./hero-carousel";

export function Hero({ products, cmsHero }: Readonly<{ readonly products?: readonly HotspotProduct[]; readonly cmsHero?: Extract<HomepageCmsSection, { readonly type: "hero" }> }>) {
  return <HeroCarousel products={products ?? []} cmsHero={cmsHero} />;
}
