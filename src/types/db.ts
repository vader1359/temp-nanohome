import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables, TablesInsert, TablesUpdate } from "./database.types";

export type { Database, Json, Tables, TablesInsert, TablesUpdate } from "./database.types";

export type TypedSupabaseClient = SupabaseClient<Database, "public">;

export type Product = Tables<"products">;
export type ProductInsert = TablesInsert<"products">;
export type ProductUpdate = TablesUpdate<"products">;
export type Variant = Tables<"variants">;
export type Category = Tables<"categories">;
export type Brand = Tables<"brands">;
export type Designer = Tables<"designers">;
export type News = Tables<"news">;
export type Catalog = Tables<"catalogs">;
export type Cart = Tables<"carts">;
export type CartItem = Tables<"cart_items">;
export type Order = Tables<"orders">;
export type OrderInsert = TablesInsert<"orders">;
export type OrderItem = Tables<"order_items">;
export type Profile = Tables<"profiles">;
export type SitePage = Tables<"site_pages">;
export type PageSection = Tables<"page_sections">;
export type MediaAsset = Tables<"media_assets">;
export type HeroSlide = Tables<"hero_slides">;
export type HeroHotspot = Tables<"hero_hotspots">;
export type ProductCuration = Tables<"product_curations">;
export type ProductCurationItem = Tables<"product_curation_items">;
export type ContentCarousel = Tables<"content_carousels">;
export type ContentCarouselItem = Tables<"content_carousel_items">;
export type RevalidationWebhookEventInsert = TablesInsert<"revalidation_webhook_events">;
