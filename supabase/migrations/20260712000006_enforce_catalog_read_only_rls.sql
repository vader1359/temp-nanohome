revoke all on public.brands, public.categories, public.designers, public.news, public.catalogs, public.products, public.variants, public.product_designers, public.news_products, public.news_variants from anon, authenticated;
grant select on public.brands, public.categories, public.designers, public.news, public.catalogs, public.products, public.variants, public.product_designers, public.news_products, public.news_variants to anon, authenticated;

alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.designers enable row level security;
alter table public.news enable row level security;
alter table public.catalogs enable row level security;
alter table public.products enable row level security;
alter table public.variants enable row level security;
alter table public.product_designers enable row level security;
alter table public.news_products enable row level security;
alter table public.news_variants enable row level security;

drop policy if exists "brands are publicly readable" on public.brands;
drop policy if exists "categories are publicly readable" on public.categories;
drop policy if exists "designers are publicly readable" on public.designers;
drop policy if exists "news are publicly readable" on public.news;
drop policy if exists "catalogs are publicly readable" on public.catalogs;
drop policy if exists "products are publicly readable" on public.products;
drop policy if exists "variants are publicly readable" on public.variants;
drop policy if exists "product designers are publicly readable" on public.product_designers;
drop policy if exists "news products are publicly readable" on public.news_products;
drop policy if exists "news variants are publicly readable" on public.news_variants;

create policy public_read_validated_brands on public.brands for select to anon, authenticated using (validated);
create policy public_read_published_categories on public.categories for select to anon, authenticated using (approved and validated);
create policy public_read_validated_designers on public.designers for select to anon, authenticated using (validated);
create policy public_read_validated_news on public.news for select to anon, authenticated using (validated);
create policy public_read_catalogs on public.catalogs for select to anon, authenticated using (true);
create policy public_read_validated_products on public.products for select to anon, authenticated using (validated);
create policy public_read_validated_variants on public.variants for select to anon, authenticated using (validated);
create policy public_read_product_designers on public.product_designers for select to anon, authenticated using (true);
create policy public_read_news_products on public.news_products for select to anon, authenticated using (true);
create policy public_read_news_variants on public.news_variants for select to anon, authenticated using (true);
