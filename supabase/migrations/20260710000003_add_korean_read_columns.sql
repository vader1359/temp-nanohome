alter table public.brands
  add column if not exists description_ko text,
  add column if not exists origin_ko text;

alter table public.catalogs
  add column if not exists origin_ko text;

alter table public.categories
  add column if not exists name_ko text;

alter table public.news
  add column if not exists title_ko text;

alter table public.products
  add column if not exists name_ko text,
  add column if not exists slug_ko text,
  add column if not exists description_ko text;

alter table public.variants
  add column if not exists name_ko text,
  add column if not exists short_name_ko text,
  add column if not exists slug_ko text,
  add column if not exists description_ko text,
  add column if not exists meta_title_ko text,
  add column if not exists meta_description_ko text,
  add column if not exists finish_ko text,
  add column if not exists designer_description_ko text,
  add column if not exists brand_origin_ko text,
  add column if not exists filter_room_ko text[] default '{}'::text[],
  add column if not exists cldr_media_closeup_alt_ko text,
  add column if not exists cldr_media_lifestyle_1_alt_ko text,
  add column if not exists cldr_media_lifestyle_2_alt_ko text,
  add column if not exists cldr_media_long_alt_ko text,
  add column if not exists cldr_packshot_alt_ko text;
