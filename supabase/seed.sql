-- Seed data for local Supabase development.
--
-- This file is declarative: it is NOT loaded by T8 onto the remote project
-- or run against `supabase start` during the task. The developer applies it
-- after `supabase start` and after migrations are applied:
--
--   psql -f supabase/tests/fixtures.sql -f supabase/seed.sql \
--     "postgresql://postgres:postgres@localhost:54322/postgres"
--
-- All IDs are stable UUIDs declared in supabase/tests/fixtures.sql.
--
-- Per plan line 246 the dataset contains:
--   2 brands, 3 categories, 5 products (3 approved+validated,
--   1 approved=false, 1 validated=false), 8 variants, 2 news, 1 catalog.
-- No production data is referenced. Inserted as the `postgres` superuser
-- (bypasses RLS); rows are visible to developers and local test clients.

\i supabase/tests/fixtures.sql

-- Brands (2): both approved + validated so product-level filters are not masked.
insert into public.brands (id, name, slug, origin, origin_vi, approved, validated)
values
  (:brand_id_1, 'Acme Test Brand 1', 'acme-test-brand-1', 'Italy', 'Ý', true, true),
  (:brand_id_2, 'Acme Test Brand 2', 'acme-test-brand-2', 'Denmark', 'Đan Mạch', true, true)
on conflict (id) do update set
  name    = excluded.name,
  slug    = excluded.slug,
  origin  = excluded.origin,
  origin_vi = excluded.origin_vi,
  approved = excluded.approved,
  validated = excluded.validated;

-- Categories (3): all root (parent_id NULL), approved + validated.
insert into public.categories (id, name, slug, parent_id, approved, validated)
values
  (:cat_id_1, 'Lighting', 'lighting', null, true, true),
  (:cat_id_2, 'Seating',  'seating',  null, true, true),
  (:cat_id_3, 'Tables',   'tables',   null, true, true)
on conflict (id) do update set
  name      = excluded.name,
  slug      = excluded.slug,
  parent_id = excluded.parent_id,
  approved  = excluded.approved,
  validated = excluded.validated;

-- Products (5):
--   prod_id_1..3 = approved + validated  (visibility filter pass)
--   prod_id_4    = approved=false         (approved filter fail)
--   prod_id_5    = validated=false        (validated filter fail)
insert into public.products (
  id, name, slug, brand_id, category_id, approved, validated
) values
  (:prod_id_1, 'Test Product 1', 'test-product-1', :brand_id_1, :cat_id_1, true,  true),
  (:prod_id_2, 'Test Product 2', 'test-product-2', :brand_id_1, :cat_id_2, true,  true),
  (:prod_id_3, 'Test Product 3', 'test-product-3', :brand_id_2, :cat_id_3, true,  true),
  (:prod_id_4, 'Test Product 4', 'test-product-4', :brand_id_2, :cat_id_1, false, true),
  (:prod_id_5, 'Test Product 5', 'test-product-5', :brand_id_1, :cat_id_2, true,  false)
on conflict (id) do update set
  name        = excluded.name,
  slug        = excluded.slug,
  brand_id    = excluded.brand_id,
  category_id = excluded.category_id,
  approved    = excluded.approved,
  validated   = excluded.validated;

-- Variants (8): distributed across products.
--   variant_id_8 = approved=false   (variant-level visibility filter fail)
-- All variants attach to a parent product so FK constraints are satisfied.
insert into public.variants (
  id, product_id, brand_id, category_id, name, sku, slug, price,
  in_stock, on_sale, approved, validated
) values
  (:variant_id_1, :prod_id_1, :brand_id_1, :cat_id_1, 'Test Variant 1', 'SKU-TV-001', 'test-variant-1',  10.00, true,  false, true, true),
  (:variant_id_2, :prod_id_1, :brand_id_1, :cat_id_1, 'Test Variant 2', 'SKU-TV-002', 'test-variant-2',  15.00, false, false, true, true),
  (:variant_id_3, :prod_id_2, :brand_id_1, :cat_id_2, 'Test Variant 3', 'SKU-TV-003', 'test-variant-3',  20.00, true,  false, true, true),
  (:variant_id_4, :prod_id_2, :brand_id_1, :cat_id_2, 'Test Variant 4', 'SKU-TV-004', 'test-variant-4',  25.00, false, false, true, true),
  (:variant_id_5, :prod_id_3, :brand_id_2, :cat_id_3, 'Test Variant 5', 'SKU-TV-005', 'test-variant-5',  30.00, true,  false, true, true),
  (:variant_id_6, :prod_id_3, :brand_id_2, :cat_id_3, 'Test Variant 6', 'SKU-TV-006', 'test-variant-6',  35.00, false, false, true, true),
  (:variant_id_7, :prod_id_4, :brand_id_2, :cat_id_1, 'Test Variant 7', 'SKU-TV-007', 'test-variant-7',  40.00, true,  true,  true, true),
  (:variant_id_8, :prod_id_5, :brand_id_1, :cat_id_2, 'Test Variant 8', 'SKU-TV-008', 'test-variant-8',  45.00, true,  false, false, true)
on conflict (id) do update set
  product_id  = excluded.product_id,
  brand_id    = excluded.brand_id,
  category_id = excluded.category_id,
  name        = excluded.name,
  sku         = excluded.sku,
  slug        = excluded.slug,
  price       = excluded.price,
  in_stock    = excluded.in_stock,
  on_sale     = excluded.on_sale,
  approved    = excluded.approved,
  validated   = excluded.validated;

-- News (2): both approved + validated.
insert into public.news (id, title, slug, approved, validated)
values
  (:news_id_1, 'Test News 1', 'test-news-1', true, true),
  (:news_id_2, 'Test News 2', 'test-news-2', true, true)
on conflict (id) do update set
  title     = excluded.title,
  slug      = excluded.slug,
  approved  = excluded.approved,
  validated = excluded.validated;

-- Catalogs (1): tied to brand_id_1. brand_name is unique and must match the
-- brand's name to keep catalog↔brand consistency for catalog tests.
insert into public.catalogs (id, brand_id, brand_name)
values
  (:catalog_id_1, :brand_id_1, 'Acme Test Brand 1')
on conflict (id) do update set
  brand_id   = excluded.brand_id,
  brand_name = excluded.brand_name;
