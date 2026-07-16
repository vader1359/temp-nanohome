-- Local-only recovery baseline for the historical migration chain.
-- Do not apply to linked or production Supabase projects.

create table public.brands (
  id uuid primary key default gen_random_uuid(), airtable_id text unique, name text not null, slug text,
  origin text, origin_vi text, description text, description_vi text, logo_url text, meta_title text, meta_description text,
  validated boolean not null default false, approved boolean not null default false, raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(), airtable_id text unique, name text not null, slug text, parent_category text,
  name_vi text, meta_title text, meta_description text, validated boolean not null default false, approved boolean not null default false,
  raw jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  parent_id uuid references public.categories(id) on delete set null,
  constraint categories_parent_id_not_self check (parent_id is null or parent_id <> id)
);

create table public.designers (
  id uuid primary key default gen_random_uuid(), airtable_id text unique, name text not null, slug text, description text,
  portrait_url text, priority integer, validated boolean not null default false, approved boolean not null default false,
  raw jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.news (
  id uuid primary key default gen_random_uuid(), airtable_id text unique, title text not null, title_vi text, slug text,
  description text, meta_title text, meta_description text, cover_url text, notion_url text, route text,
  approved boolean not null default false, validated boolean not null default false, source_created_at timestamptz,
  raw jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.catalogs (
  id uuid primary key default gen_random_uuid(), brand_id uuid references public.brands(id) on delete set null,
  brand_name text not null unique, origin text, origin_vi text, file_urls text[] not null default '{}'::text[],
  cloudinary_urls text[] not null default '{}'::text[], cloudinary_ids text[] not null default '{}'::text[],
  raw jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(), airtable_id text unique, name text not null, name_vi text, slug text, slug_vi text,
  description text, description_vi text, brand_id uuid references public.brands(id) on delete set null,
  designer_id uuid references public.designers(id) on delete set null, category_id uuid references public.categories(id) on delete set null,
  product_line text, size text, priority integer, media_image_url text, media_video_url text,
  validated boolean not null default false, approved boolean not null default false, source_created_at timestamptz,
  raw jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.variants (
  id uuid primary key default gen_random_uuid(), airtable_id text unique, product_id uuid references public.products(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null, designer_id uuid references public.designers(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null, name text not null, sku text, slug text, slug_vi text,
  price numeric(14,2), compare_at_price numeric(14,2), discount_percent numeric(6,2), in_stock boolean not null default false,
  on_sale boolean not null default false, approved boolean not null default false, validated boolean not null default false,
  finish text, finish_vi text, size text, packshot_url text, gallery_urls text[] not null default '{}'::text[],
  cloudinary_ids text[] not null default '{}'::text[], meta_title text, meta_description text, priority integer,
  source_created_at timestamptz, source_updated_at timestamptz, raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  name_vi text, short_name text, short_name_vi text, description text, description_vi text, meta_title_vi text, meta_description_vi text,
  designer_description text, designer_description_vi text, designer_name text, designer_cldr_id_portrait text, brand_origin text,
  brand_origin_vi text, brand_name_denorm text, brand_logo_size integer, brand_cldr_logo text, brand_cldr_id_logo text,
  product_name_denorm text, product_line text, packshot_size integer, is_clearance_sale boolean default false,
  is_clearance_sale_bak boolean default false, is_usm_sale boolean default false, is_knoll_preorder boolean default false,
  is_children_day_sale boolean default false, is_yes26_left boolean default false, is_stylist_pick boolean default false,
  is_new boolean default false, is_weird boolean default false, missed_sku boolean default false,
  filter_room text[] default '{}'::text[], filter_room_vi text[] default '{}'::text[], filter_brand text, filter_category text,
  filter_sub_category text, filter_collection_pk boolean default false, filter_collection_jaime boolean default false,
  filter_collection_balcony boolean default false, filter_collection_ph boolean default false, filter_collection_art boolean default false,
  filter_is_new_arrival boolean default false, filter_is_gifting_ideas boolean default false, filter_price text, filter_price_gift text,
  filter_product_line text, cldr_packshot_alt text, cldr_packshot_alt_vi text, cldr_media_long_alt text, cldr_media_long_alt_vi text,
  cldr_media_closeup_alt text, cldr_media_closeup_alt_vi text, cldr_media_lifestyle_1_alt text, cldr_media_lifestyle_1_alt_vi text,
  cldr_media_lifestyle_2_alt text, cldr_media_lifestyle_2_alt_vi text, cldr_media_illustration text, cldr_id_media_illustration text,
  cldr_id_packshot text, cldr_id_media_long text, cldr_id_media_closeup text, cldr_id_media_lifestyle_1 text,
  cldr_id_media_lifestyle_2 text, cldr_id_media_info_as_image text, cldr_media_long text, cldr_media_closeup text,
  cldr_media_lifestyle_1 text, cldr_media_lifestyle_2 text, media_info_as_image text, feature_text text, test_sku text,
  same_sub_category_variant_ids text[] default '{}'::text[], same_designer_variant_ids text[] default '{}'::text[],
  same_brand_variant_ids text[] default '{}'::text[], cldr_media_info_as_image text, media_long text, media_closeup text,
  media_lifestyle_1 text, media_lifestyle_2 text, news_id text
);

create table public.product_designers (
  product_id uuid not null references public.products(id) on delete cascade,
  designer_id uuid not null references public.designers(id) on delete cascade,
  primary key (product_id, designer_id)
);
create table public.news_products (
  news_id uuid not null references public.news(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (news_id, product_id)
);
create table public.news_variants (
  news_id uuid not null references public.news(id) on delete cascade,
  variant_id uuid not null references public.variants(id) on delete cascade,
  primary key (news_id, variant_id)
);
