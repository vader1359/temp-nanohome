create table public.site_pages (
  id uuid primary key default gen_random_uuid(), slug text not null unique check (slug = btrim(slug) and slug <> ''),
  title text, title_vi text, title_ko text, approved boolean not null default false, validated boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.page_sections (
  id uuid primary key default gen_random_uuid(), page_id uuid not null references public.site_pages(id) on delete cascade,
  section_type text not null check (section_type in ('hero', 'product_curation', 'content_carousel')),
  sort_order integer not null check (sort_order >= 0), enabled boolean not null default true,
  approved boolean not null default false, validated boolean not null default false, starts_at timestamptz, ends_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint page_sections_schedule_check check (ends_at is null or starts_at is null or starts_at < ends_at),
  constraint page_sections_page_order_unique unique (page_id, sort_order)
);
create table public.media_assets (
  id uuid primary key default gen_random_uuid(), public_id text not null unique check (public_id = btrim(public_id) and public_id <> ''),
  delivery_url text not null unique check (delivery_url like 'https://res.cloudinary.com/%'), asset_type text not null check (asset_type in ('image', 'video')),
  width integer not null check (width > 0), height integer not null check (height > 0), alt_text text not null check (alt_text = btrim(alt_text) and alt_text <> ''),
  alt_text_vi text, alt_text_ko text, focal_x numeric(5,2) not null default 50 check (focal_x between 0 and 100), focal_y numeric(5,2) not null default 50 check (focal_y between 0 and 100),
  approved boolean not null default false, validated boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.hero_slides (
  id uuid primary key default gen_random_uuid(), section_id uuid not null references public.page_sections(id) on delete cascade,
  desktop_media_id uuid not null references public.media_assets(id) on delete restrict, mobile_media_id uuid references public.media_assets(id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0), eyebrow text, eyebrow_vi text, eyebrow_ko text, title text not null check (title = btrim(title) and title <> ''), title_vi text, title_ko text,
  body text, body_vi text, body_ko text, cta_label text, cta_label_vi text, cta_label_ko text, cta_href text, overlay_strength numeric(3,2) not null default 0 check (overlay_strength between 0 and 1),
  approved boolean not null default false, validated boolean not null default false, starts_at timestamptz, ends_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), constraint hero_slides_schedule_check check (ends_at is null or starts_at is null or starts_at < ends_at)
);
create table public.hero_hotspots (
  id uuid primary key default gen_random_uuid(), hero_slide_id uuid not null references public.hero_slides(id) on delete cascade, variant_id uuid not null references public.variants(id) on delete restrict,
  x_percent numeric(5,2) not null check (x_percent between 0 and 100), y_percent numeric(5,2) not null check (y_percent between 0 and 100), placement text not null default 'right' check (placement in ('top', 'right', 'bottom', 'left')),
  sort_order integer not null default 0 check (sort_order >= 0), created_at timestamptz not null default now(),
  constraint hero_hotspots_slide_variant_unique unique (hero_slide_id, variant_id), constraint hero_hotspots_slide_order_unique unique (hero_slide_id, sort_order)
);
create table public.product_curations (
  id uuid primary key default gen_random_uuid(), section_id uuid not null unique references public.page_sections(id) on delete cascade, title text not null check (title = btrim(title) and title <> ''), title_vi text, title_ko text,
  selection_mode text not null default 'manual' check (selection_mode = 'manual'), hide_out_of_stock boolean not null default false, approved boolean not null default false, validated boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_curation_items (
  id uuid primary key default gen_random_uuid(), curation_id uuid not null references public.product_curations(id) on delete cascade, variant_id uuid not null references public.variants(id) on delete restrict,
  sort_order integer not null check (sort_order >= 0), created_at timestamptz not null default now(),
  constraint product_curation_items_curation_variant_unique unique (curation_id, variant_id), constraint product_curation_items_curation_order_unique unique (curation_id, sort_order)
);
create table public.content_carousels (
  id uuid primary key default gen_random_uuid(), section_id uuid not null unique references public.page_sections(id) on delete cascade, title text, title_vi text, title_ko text,
  approved boolean not null default false, validated boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.content_carousel_items (
  id uuid primary key default gen_random_uuid(), carousel_id uuid not null references public.content_carousels(id) on delete cascade, media_id uuid not null references public.media_assets(id) on delete restrict,
  sort_order integer not null check (sort_order >= 0), title text, title_vi text, title_ko text, body text, body_vi text, body_ko text, href text,
  approved boolean not null default false, validated boolean not null default false, starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint content_carousel_items_schedule_check check (ends_at is null or starts_at is null or starts_at < ends_at), constraint content_carousel_items_carousel_order_unique unique (carousel_id, sort_order)
);
create table public.catalog_audit_log (
  id uuid primary key default gen_random_uuid(), actor_role text not null, source text not null check (source in ('nocodb', 'system')),
  table_name text not null, record_id uuid not null, action text not null check (action in ('insert', 'update', 'delete')), before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
create index page_sections_active_lookup_idx on public.page_sections (page_id, sort_order) where enabled and approved and validated;
create index hero_slides_active_lookup_idx on public.hero_slides (section_id, sort_order) where approved and validated;
create index content_carousel_items_active_lookup_idx on public.content_carousel_items (carousel_id, sort_order) where approved and validated;
insert into public.site_pages (slug, title, approved, validated) values ('home', 'Home', true, true) on conflict (slug) do nothing;
