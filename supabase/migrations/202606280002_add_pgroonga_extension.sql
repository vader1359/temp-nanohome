create extension if not exists pgroonga;

create index if not exists products_pgroonga_idx
  on public.products
  using pgroonga (name, name_vi, description, description_vi);

create index if not exists variants_pgroonga_idx
  on public.variants
  using pgroonga (name, sku, finish, finish_vi);
