create unique index if not exists products_slug_unique_idx
  on public.products (slug)
  where slug is not null;

create unique index if not exists products_slug_vi_unique_idx
  on public.products (slug_vi)
  where slug_vi is not null;

create unique index if not exists variants_slug_unique_idx
  on public.variants (slug)
  where slug is not null;

create unique index if not exists variants_slug_vi_unique_idx
  on public.variants (slug_vi)
  where slug_vi is not null;

create unique index if not exists brands_slug_unique_idx
  on public.brands (slug)
  where slug is not null;

create unique index if not exists designers_slug_unique_idx
  on public.designers (slug)
  where slug is not null;

create unique index if not exists categories_slug_unique_idx
  on public.categories (slug)
  where slug is not null;

create unique index if not exists news_slug_unique_idx
  on public.news (slug)
  where slug is not null;
