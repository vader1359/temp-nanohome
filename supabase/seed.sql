-- Seed data for local Supabase development.
--
-- This file is declarative: it is NOT loaded by T8 onto the remote project
-- or run against `supabase start` during the task. The developer applies it
-- after `supabase start` and after migrations are applied:
--
--   psql -f supabase/tests/fixtures.sql -f supabase/seed.sql \
--     "postgresql://postgres:postgres@localhost:54322/postgres"
--
-- All IDs are stable UUID literals so Supabase CLI can execute this file directly.
--
-- Per plan line 246 the dataset contains:
--   2 brands, 3 categories, 5 products (3 approved+validated,
--   1 approved=false, 1 validated=false), 8 variants, 2 news, 1 catalog.
-- No production data is referenced. Inserted as the `postgres` superuser
-- (bypasses RLS); rows are visible to developers and local test clients.

-- Brands (2): both approved + validated so product-level filters are not masked.
insert into public.brands (id, name, slug, origin, origin_vi, origin_ko, description_ko, approved, validated)
values
  ('00000000-0000-4000-8000-000000000001', 'Acme Test Brand 1', 'acme-test-brand-1', 'Italy', 'Ý', '이탈리아', '이탈리아 디자인 브랜드', true, true),
  ('00000000-0000-4000-8000-000000000002', 'Acme Test Brand 2', 'acme-test-brand-2', 'Denmark', 'Đan Mạch', '덴마크', '덴마크 디자인 브랜드', true, true)
on conflict (id) do update set
  name           = excluded.name,
  slug           = excluded.slug,
  origin         = excluded.origin,
  origin_vi      = excluded.origin_vi,
  origin_ko      = excluded.origin_ko,
  description_ko = excluded.description_ko,
  approved       = excluded.approved,
  validated      = excluded.validated;

-- Categories (3): all root (parent_id NULL), approved + validated.
insert into public.categories (id, name, name_ko, slug, parent_id, approved, validated)
values
  ('00000000-0000-4000-8000-000000000011', 'Lighting', '조명', 'lighting', null, true, true),
  ('00000000-0000-4000-8000-000000000012', 'Seating',  '의자', 'seating',  null, true, true),
  ('00000000-0000-4000-8000-000000000013', 'Tables',   '테이블', 'tables',   null, true, true)
on conflict (id) do update set
  name      = excluded.name,
  name_ko   = excluded.name_ko,
  slug      = excluded.slug,
  parent_id = excluded.parent_id,
  approved  = excluded.approved,
  validated = excluded.validated;

-- Products (5):
--   prod_id_1..3 = approved + validated  (visibility filter pass)
--   prod_id_4    = approved=false         (approved filter fail)
--   prod_id_5    = validated=false        (validated filter fail)
insert into public.products (
  id, name, name_ko, slug, slug_ko, description_ko, brand_id, category_id, approved, validated
) values
  ('00000000-0000-4000-8000-000000000021', 'Test Product 1', '테스트 제품 1', 'test-product-1', '테스트-제품-1', '한국어 제품 설명 1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', true,  true),
  ('00000000-0000-4000-8000-000000000022', 'Test Product 2', '테스트 제품 2', 'test-product-2', '테스트-제품-2', '한국어 제품 설명 2', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', true,  true),
  ('00000000-0000-4000-8000-000000000023', 'Test Product 3', '테스트 제품 3', 'test-product-3', '테스트-제품-3', '한국어 제품 설명 3', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000013', true,  true),
  ('00000000-0000-4000-8000-000000000024', 'Test Product 4', '테스트 제품 4', 'test-product-4', '테스트-제품-4', '한국어 제품 설명 4', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000011', false, true),
  ('00000000-0000-4000-8000-000000000025', 'Test Product 5', '테스트 제품 5', 'test-product-5', '테스트-제품-5', '한국어 제품 설명 5', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', true,  false)
on conflict (id) do update set
  name           = excluded.name,
  name_ko        = excluded.name_ko,
  slug           = excluded.slug,
  slug_ko        = excluded.slug_ko,
  description_ko = excluded.description_ko,
  brand_id       = excluded.brand_id,
  category_id    = excluded.category_id,
  approved       = excluded.approved,
  validated      = excluded.validated;

-- Variants (8): distributed across products.
--   variant_id_8 = approved=false   (variant-level visibility filter fail)
-- All variants attach to a parent product so FK constraints are satisfied.
insert into public.variants (
  id, product_id, brand_id, category_id, name, name_ko, short_name_ko, sku, slug, slug_ko,
  description_ko, meta_title_ko, meta_description_ko, finish_ko, designer_description_ko,
  brand_origin_ko, filter_room_ko, cldr_media_closeup_alt_ko, cldr_media_lifestyle_1_alt_ko,
  cldr_media_lifestyle_2_alt_ko, cldr_media_long_alt_ko, cldr_packshot_alt_ko, price,
  in_stock, on_sale, approved, validated
) values
  ('00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Test Variant 1', '테스트 옵션 1', '옵션 1', 'SKU-TV-001', 'test-variant-1', '테스트-옵션-1', '한국어 옵션 설명 1', '테스트 옵션 1 | 나노홈', '한국어 메타 설명 1', '무광 검정', '한국어 디자이너 설명 1', '이탈리아', array['거실'], '옵션 1 클로즈업', '옵션 1 라이프스타일 1', '옵션 1 라이프스타일 2', '옵션 1 롱 이미지', '옵션 1 팩샷', 10.00, true, false, true, true),
  ('00000000-0000-4000-8000-000000000032', '00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Test Variant 2', '테스트 옵션 2', '옵션 2', 'SKU-TV-002', 'test-variant-2', '테스트-옵션-2', '한국어 옵션 설명 2', '테스트 옵션 2 | 나노홈', '한국어 메타 설명 2', '유광 흰색', '한국어 디자이너 설명 2', '이탈리아', array['침실'], '옵션 2 클로즈업', '옵션 2 라이프스타일 1', '옵션 2 라이프스타일 2', '옵션 2 롱 이미지', '옵션 2 팩샷', 15.00, false, false, true, true),
  ('00000000-0000-4000-8000-000000000033', '00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'Test Variant 3', '테스트 옵션 3', '옵션 3', 'SKU-TV-003', 'test-variant-3', '테스트-옵션-3', '한국어 옵션 설명 3', '테스트 옵션 3 | 나노홈', '한국어 메타 설명 3', '회색', '한국어 디자이너 설명 3', '이탈리아', array['거실'], '옵션 3 클로즈업', '옵션 3 라이프스타일 1', '옵션 3 라이프스타일 2', '옵션 3 롱 이미지', '옵션 3 팩샷', 20.00, true, false, true, true),
  ('00000000-0000-4000-8000-000000000034', '00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'Test Variant 4', '테스트 옵션 4', '옵션 4', 'SKU-TV-004', 'test-variant-4', '테스트-옵션-4', '한국어 옵션 설명 4', '테스트 옵션 4 | 나노홈', '한국어 메타 설명 4', '베이지', '한국어 디자이너 설명 4', '이탈리아', array['서재'], '옵션 4 클로즈업', '옵션 4 라이프스타일 1', '옵션 4 라이프스타일 2', '옵션 4 롱 이미지', '옵션 4 팩샷', 25.00, false, false, true, true),
  ('00000000-0000-4000-8000-000000000035', '00000000-0000-4000-8000-000000000023', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000013', 'Test Variant 5', '테스트 옵션 5', '옵션 5', 'SKU-TV-005', 'test-variant-5', '테스트-옵션-5', '한국어 옵션 설명 5', '테스트 옵션 5 | 나노홈', '한국어 메타 설명 5', '참나무', '한국어 디자이너 설명 5', '덴마크', array['식당'], '옵션 5 클로즈업', '옵션 5 라이프스타일 1', '옵션 5 라이프스타일 2', '옵션 5 롱 이미지', '옵션 5 팩샷', 30.00, true, false, true, true),
  ('00000000-0000-4000-8000-000000000036', '00000000-0000-4000-8000-000000000023', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000013', 'Test Variant 6', '테스트 옵션 6', '옵션 6', 'SKU-TV-006', 'test-variant-6', '테스트-옵션-6', '한국어 옵션 설명 6', '테스트 옵션 6 | 나노홈', '한국어 메타 설명 6', '호두나무', '한국어 디자이너 설명 6', '덴마크', array['식당'], '옵션 6 클로즈업', '옵션 6 라이프스타일 1', '옵션 6 라이프스타일 2', '옵션 6 롱 이미지', '옵션 6 팩샷', 35.00, false, false, true, true),
  ('00000000-0000-4000-8000-000000000037', '00000000-0000-4000-8000-000000000024', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000011', 'Test Variant 7', '테스트 옵션 7', '옵션 7', 'SKU-TV-007', 'test-variant-7', '테스트-옵션-7', '한국어 옵션 설명 7', '테스트 옵션 7 | 나노홈', '한국어 메타 설명 7', '은색', '한국어 디자이너 설명 7', '덴마크', array['현관'], '옵션 7 클로즈업', '옵션 7 라이프스타일 1', '옵션 7 라이프스타일 2', '옵션 7 롱 이미지', '옵션 7 팩샷', 40.00, true, true, true, true),
  ('00000000-0000-4000-8000-000000000038', '00000000-0000-4000-8000-000000000025', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'Test Variant 8', '테스트 옵션 8', '옵션 8', 'SKU-TV-008', 'test-variant-8', '테스트-옵션-8', '한국어 옵션 설명 8', '테스트 옵션 8 | 나노홈', '한국어 메타 설명 8', '검정', '한국어 디자이너 설명 8', '이탈리아', array['거실'], '옵션 8 클로즈업', '옵션 8 라이프스타일 1', '옵션 8 라이프스타일 2', '옵션 8 롱 이미지', '옵션 8 팩샷', 45.00, true, false, false, true)
on conflict (id) do update set
  product_id                     = excluded.product_id,
  brand_id                       = excluded.brand_id,
  category_id                    = excluded.category_id,
  name                           = excluded.name,
  name_ko                        = excluded.name_ko,
  short_name_ko                  = excluded.short_name_ko,
  sku                            = excluded.sku,
  slug                           = excluded.slug,
  slug_ko                        = excluded.slug_ko,
  description_ko                 = excluded.description_ko,
  meta_title_ko                  = excluded.meta_title_ko,
  meta_description_ko            = excluded.meta_description_ko,
  finish_ko                      = excluded.finish_ko,
  designer_description_ko        = excluded.designer_description_ko,
  brand_origin_ko                = excluded.brand_origin_ko,
  filter_room_ko                 = excluded.filter_room_ko,
  cldr_media_closeup_alt_ko      = excluded.cldr_media_closeup_alt_ko,
  cldr_media_lifestyle_1_alt_ko  = excluded.cldr_media_lifestyle_1_alt_ko,
  cldr_media_lifestyle_2_alt_ko  = excluded.cldr_media_lifestyle_2_alt_ko,
  cldr_media_long_alt_ko         = excluded.cldr_media_long_alt_ko,
  cldr_packshot_alt_ko           = excluded.cldr_packshot_alt_ko,
  price                          = excluded.price,
  in_stock                       = excluded.in_stock,
  on_sale                        = excluded.on_sale,
  approved                       = excluded.approved,
  validated                      = excluded.validated;

-- News (2): both approved + validated.
insert into public.news (id, title, title_ko, slug, approved, validated)
values
  ('00000000-0000-4000-8000-000000000041', 'Test News 1', '테스트 뉴스 1', 'test-news-1', true, true),
  ('00000000-0000-4000-8000-000000000042', 'Test News 2', '테스트 뉴스 2', 'test-news-2', true, true)
on conflict (id) do update set
  title      = excluded.title,
  title_ko   = excluded.title_ko,
  slug       = excluded.slug,
  approved   = excluded.approved,
  validated  = excluded.validated;

-- Catalogs (1): tied to brand_id_1. brand_name is unique and must match the
-- brand's name to keep catalog↔brand consistency for catalog tests.
insert into public.catalogs (id, brand_id, brand_name, origin_ko)
values
  ('00000000-0000-4000-8000-000000000051', '00000000-0000-4000-8000-000000000001', 'Acme Test Brand 1', '이탈리아')
on conflict (id) do update set
  brand_id   = excluded.brand_id,
  brand_name = excluded.brand_name,
  origin_ko  = excluded.origin_ko;
