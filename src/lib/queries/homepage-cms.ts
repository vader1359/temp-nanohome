import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/server";
import type { VariantProductListItem } from "@/lib/queries/products";
import type { ContentCarouselItem, HeroHotspot, HeroSlide, MediaAsset, PageSection, SitePage } from "@/types/db";

export type HomepageCmsLocale = "en" | "ko" | "vi";
type SectionType = "hero" | "product_curation" | "content_carousel";
type Placement = "top" | "right" | "bottom" | "left";

export type HomepageCmsMedia = Pick<MediaAsset, "id" | "delivery_url" | "width" | "height" | "focal_x" | "focal_y"> & { readonly alt: string };
export type HomepageCmsHotspot = Pick<HeroHotspot, "id"> & { readonly variantId: string; readonly xPercent: number; readonly yPercent: number; readonly placement: Placement };
export type HomepageCmsSlide = Pick<HeroSlide, "id" | "title" | "body" | "eyebrow" | "cta_href" | "overlay_strength"> & { readonly ctaLabel: string | null; readonly media: HomepageCmsMedia; readonly mobileMedia: HomepageCmsMedia | null; readonly hotspots: readonly HomepageCmsHotspot[] };
export type HomepageCmsCarouselItem = Pick<ContentCarouselItem, "id" | "body" | "href"> & { readonly title: string | null; readonly media: HomepageCmsMedia };
export type HomepageCmsSection =
  | { readonly type: "hero"; readonly slides: readonly HomepageCmsSlide[] }
  | { readonly type: "product_curation"; readonly title: string; readonly items: readonly VariantProductListItem[] }
  | { readonly type: "content_carousel"; readonly title: string; readonly items: readonly HomepageCmsCarouselItem[] };
export type HomepageCmsModel = { readonly sections: readonly HomepageCmsSection[] };

const EMPTY_HOMEPAGE_CMS: HomepageCmsModel = { sections: [] };
const VARIANT_COLUMNS = "id,name,name_vi,name_ko,short_name,short_name_vi,short_name_ko,slug,slug_vi,slug_ko,sku,stock,price,compare_at_price,discount_percent,on_sale,in_stock,packshot_url,gallery_urls,finish,finish_vi,finish_ko,size,product_id,brand_id,designer_id,brand_cldr_logo,brand_name_denorm,category_id,filter_brand,filter_category,filter_room,filter_room_vi,filter_room_ko,media_lifestyle_1,media_lifestyle_2,cldr_media_lifestyle_1,cldr_media_lifestyle_2,media_long,media_closeup,filter_sub_category,filter_is_new_arrival";

function localized(locale: HomepageCmsLocale, english: string | null, ko: string | null, vi: string | null): string | null {
  return locale === "ko" ? ko ?? english : locale === "vi" ? vi ?? english : english;
}
function sectionType(value: string): SectionType | null {
  switch (value) { case "hero": case "product_curation": case "content_carousel": return value; default: return null; }
}
function placement(value: string): Placement | null {
  switch (value) { case "top": case "right": case "bottom": case "left": return value; default: return null; }
}
function active(row: Pick<PageSection, "starts_at" | "ends_at"> | Pick<HeroSlide, "starts_at" | "ends_at"> | Pick<ContentCarouselItem, "starts_at" | "ends_at">, now: string): boolean {
  return (row.starts_at === null || row.starts_at === undefined || row.starts_at <= now) && (row.ends_at === null || row.ends_at === undefined || row.ends_at >= now);
}
function mediaMap(rows: readonly MediaAsset[], locale: HomepageCmsLocale): ReadonlyMap<string, HomepageCmsMedia> {
  return new Map(rows.filter((row) => row.asset_type === "image" && row.approved && row.validated).map((row) => [row.id, { id: row.id, delivery_url: row.delivery_url, width: row.width, height: row.height, focal_x: row.focal_x, focal_y: row.focal_y, alt: localized(locale, row.alt_text, row.alt_text_ko, row.alt_text_vi) ?? row.alt_text }]));
}
function mediaFor(media: ReadonlyMap<string, HomepageCmsMedia>, id: string | null): HomepageCmsMedia | null { return id === null ? null : media.get(id) ?? null; }

async function loadHomepageCms(locale: HomepageCmsLocale): Promise<HomepageCmsModel> {
  const supabase = createPublicClient();
  const now = new Date().toISOString();
  const pageResult = await supabase.from("site_pages").select("*").eq("slug", "home").eq("approved", true).eq("validated", true).maybeSingle();
  if (pageResult.error !== null) {
    if (pageResult.error.code === "PGRST205") return EMPTY_HOMEPAGE_CMS;
    throw pageResult.error;
  }
  const page: SitePage | null = pageResult.data;
  if (page === null) return EMPTY_HOMEPAGE_CMS;

  const sectionResult = await supabase.from("page_sections").select("*").eq("page_id", page.id).eq("enabled", true).eq("approved", true).eq("validated", true).order("sort_order");
  if (sectionResult.error !== null) throw sectionResult.error;
  const sections = sectionResult.data.filter((row) => active(row, now)).sort((a, b) => a.sort_order - b.sort_order).flatMap((row) => {
    const type = sectionType(row.section_type);
    return type === null ? [] : [{ row, type }];
  });
  const heroIds = sections.filter(({ type }) => type === "hero").map(({ row }) => row.id);
  const curationIds = sections.filter(({ type }) => type === "product_curation").map(({ row }) => row.id);
  const carouselIds = sections.filter(({ type }) => type === "content_carousel").map(({ row }) => row.id);
  const slidesResult = await supabase.from("hero_slides").select("*").in("section_id", heroIds).eq("approved", true).eq("validated", true).order("sort_order");
  const curationsResult = await supabase.from("product_curations").select("*").in("section_id", curationIds).eq("approved", true).eq("validated", true);
  const carouselsResult = await supabase.from("content_carousels").select("*").in("section_id", carouselIds).eq("approved", true).eq("validated", true);
  if (slidesResult.error !== null) throw slidesResult.error;
  if (curationsResult.error !== null) throw curationsResult.error;
  if (carouselsResult.error !== null) throw carouselsResult.error;
  const slides = slidesResult.data.filter((row) => active(row, now));
  const curations = curationsResult.data;
  const carousels = carouselsResult.data;
  const slideIds = slides.map((row) => row.id);
  const curationIdsOwned = curations.map((row) => row.id);
  const carouselIdsOwned = carousels.map((row) => row.id);
  const hotspotsResult = await supabase.from("hero_hotspots").select("*").in("hero_slide_id", slideIds).order("sort_order");
  const curationItemsResult = await supabase.from("product_curation_items").select("*").in("curation_id", curationIdsOwned).order("sort_order");
  const carouselItemsResult = await supabase.from("content_carousel_items").select("*").in("carousel_id", carouselIdsOwned).eq("approved", true).eq("validated", true).order("sort_order");
  if (hotspotsResult.error !== null) throw hotspotsResult.error;
  if (curationItemsResult.error !== null) throw curationItemsResult.error;
  if (carouselItemsResult.error !== null) throw carouselItemsResult.error;
  const curationItems = curationItemsResult.data;
  const variantIds = curationItems.map((row) => row.variant_id);
  const mediaIds = [...slides.flatMap((row) => [row.desktop_media_id, row.mobile_media_id]), ...carouselItemsResult.data.map((row) => row.media_id)].filter((id): id is string => id !== null);
  const mediaResult = await supabase.from("media_assets").select("*").in("id", mediaIds).eq("approved", true).eq("validated", true);
  const variantsResult = await supabase.from("variants").select(VARIANT_COLUMNS).in("id", variantIds).eq("validated", true);
  if (mediaResult.error !== null) throw mediaResult.error;
  if (variantsResult.error !== null) throw variantsResult.error;
  const media = mediaMap(mediaResult.data, locale);
  const variants = new Map(variantsResult.data.map((row) => [row.id, row]));
  const hotspots = new Map<string, readonly HeroHotspot[]>(slides.map((slide) => [slide.id, hotspotsResult.data.filter((row) => row.hero_slide_id === slide.id)]));
  const models = sections.flatMap(({ row, type }): readonly HomepageCmsSection[] => {
    switch (type) {
      case "hero": return [{ type, slides: slides.filter((slide) => slide.section_id === row.id).flatMap((slide) => { const desktop = mediaFor(media, slide.desktop_media_id); if (desktop === null) return []; return [{ id: slide.id, title: slide.title, body: localized(locale, slide.body, slide.body_ko, slide.body_vi), eyebrow: localized(locale, slide.eyebrow, slide.eyebrow_ko, slide.eyebrow_vi), cta_href: slide.cta_href, ctaLabel: localized(locale, slide.cta_label, slide.cta_label_ko, slide.cta_label_vi), overlay_strength: slide.overlay_strength, media: desktop, mobileMedia: mediaFor(media, slide.mobile_media_id), hotspots: (hotspots.get(slide.id) ?? []).flatMap((spot) => { const valid = placement(spot.placement); return valid === null ? [] : [{ id: spot.id, variantId: spot.variant_id, xPercent: spot.x_percent, yPercent: spot.y_percent, placement: valid }]; }) }]; }) }];
      case "product_curation": { const curation = curations.find((item) => item.section_id === row.id); if (curation === undefined) return []; return [{ type, title: localized(locale, curation.title, curation.title_ko, curation.title_vi) ?? curation.title, items: curationItems.filter((item) => item.curation_id === curation.id).flatMap((item) => { const variant = variants.get(item.variant_id); return variant !== undefined && (!curation.hide_out_of_stock || variant.in_stock) ? [variant] : []; }) }]; }
      case "content_carousel": { const carousel = carousels.find((item) => item.section_id === row.id); if (carousel === undefined) return []; return [{ type, title: localized(locale, carousel.title, carousel.title_ko, carousel.title_vi) ?? "", items: carouselItemsResult.data.filter((item) => item.carousel_id === carousel.id && active(item, now)).flatMap((item) => { const itemMedia = mediaFor(media, item.media_id); return itemMedia === null ? [] : [{ id: item.id, title: localized(locale, item.title, item.title_ko, item.title_vi), body: localized(locale, item.body, item.body_ko, item.body_vi), href: item.href, media: itemMedia }]; }) }]; }
    }
  });
  return { sections: models };
}

export function getHomepageCms(locale: HomepageCmsLocale): Promise<HomepageCmsModel> {
  const getCachedHomepageCms = unstable_cache(loadHomepageCms, ["homepage", locale], {
    tags: ["homepage", `homepage:${locale}`],
    revalidate: 3600,
  });
  return getCachedHomepageCms(locale);
}
