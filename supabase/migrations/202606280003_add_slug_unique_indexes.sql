-- Unique slug indexes where approved+validated data has no duplicates:
-- products(slug), products(slug_vi), brands(slug), designers(slug), categories(slug), news(slug)
-- Variants(slug) and variants(slug_vi) intentionally use NON-unique indexes because
-- approved=true AND validated=true rows still have 21 (slug) / 26 (slug_vi) duplicate groups
-- (51 / 65 dup rows) — variants sharing display slugs across size/material combinations.
-- Composite unique constraint was rejected as destructive data cleanup outside T5 scope.

create unique index if not exists products_slug_unique_idx
  on public.products (slug)
  where slug is not null and approved = true and validated = true;

create unique index if not exists products_slug_vi_unique_idx
  on public.products (slug_vi)
  where slug_vi is not null and approved = true and validated = true;

-- Variants: non-unique regular indexes (see comment block above)
create index if not exists variants_slug_idx
  on public.variants (slug)
  where slug is not null;

create index if not exists variants_slug_vi_idx
  on public.variants (slug_vi)
  where slug_vi is not null;

create unique index if not exists brands_slug_unique_idx
  on public.brands (slug)
  where slug is not null and approved = true and validated = true;

create unique index if not exists designers_slug_unique_idx
  on public.designers (slug)
  where slug is not null and approved = true and validated = true;

create unique index if not exists categories_slug_unique_idx
  on public.categories (slug)
  where slug is not null and approved = true and validated = true;

create unique index if not exists news_slug_unique_idx
  on public.news (slug)
  where slug is not null and approved = true and validated = true;