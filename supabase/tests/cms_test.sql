BEGIN;

\ir fixtures.sql

SET LOCAL ROLE postgres;
GRANT nocodb_catalog_editor TO postgres;

SELECT plan(32);

SELECT has_table('public', 'revalidation_webhook_events', 'CMS creates a durable webhook replay ledger');
SELECT col_type_is('public', 'revalidation_webhook_events', 'event_id', 'uuid', 'replay ledger event ID is a UUID');
SELECT col_is_pk('public', 'revalidation_webhook_events', 'event_id', 'replay ledger event ID is its primary key');
SELECT col_not_null('public', 'revalidation_webhook_events', 'event_id', 'replay ledger event ID is required');
SELECT col_type_is('public', 'revalidation_webhook_events', 'received_at', 'timestamp with time zone', 'replay ledger records receipt time');
SELECT lives_ok(
  $$
    insert into public.revalidation_webhook_events (event_id)
    values ('00000000-0000-4000-8000-000000000109')
  $$,
  'first webhook event claim succeeds'
);
SELECT throws_ok(
  $$
    insert into public.revalidation_webhook_events (event_id)
    values ('00000000-0000-4000-8000-000000000109')
  $$,
  '23505',
  NULL,
  'duplicate webhook event claim is rejected'
);
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$
    insert into public.revalidation_webhook_events (event_id)
    values ('00000000-0000-4000-8000-000000000110')
  $$,
  '42501',
  NULL,
  'anon cannot claim webhook events'
);
RESET ROLE;
SELECT lives_ok(
  $$
    set local role service_role;
    insert into public.revalidation_webhook_events (event_id)
    values ('00000000-0000-4000-8000-000000000111');
    reset role;
  $$,
  'service role can claim webhook events'
);

SELECT has_table('public', 'site_pages', 'CMS creates site pages');
SELECT has_table('public', 'page_sections', 'CMS creates ordered page sections');
SELECT has_table('public', 'media_assets', 'CMS creates Cloudinary media assets');
SELECT has_table('public', 'hero_slides', 'CMS creates hero slides');
SELECT has_table('public', 'hero_hotspots', 'CMS creates hero hotspots');
SELECT has_table('public', 'product_curations', 'CMS creates product curations');
SELECT has_table('public', 'product_curation_items', 'CMS creates curation items');
SELECT has_table('public', 'content_carousels', 'CMS creates content carousels');
SELECT has_table('public', 'content_carousel_items', 'CMS creates carousel items');

SELECT lives_ok(
  $$
    insert into public.site_pages (slug, approved, validated)
    values ('cms-test-page', true, true)
  $$,
  'published CMS page can be created'
);

SELECT throws_ok(
  $$
    insert into public.hero_hotspots (hero_slide_id, variant_id, x_percent, y_percent)
    values ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000031', 101, 50)
  $$,
  '23514',
  NULL,
  'hotspot coordinates reject values above 100'
);

SELECT lives_ok(
  $$
    set local role nocodb_catalog_editor;
    insert into public.site_pages (slug) values ('nocodb-editor-page');
    reset role;
  $$,
  'NocoDB role can create CMS pages'
);

insert into public.site_pages (id, slug, approved, validated)
values ('00000000-0000-4000-8000-000000000101', 'cms-public-page', true, true);
insert into public.page_sections (id, page_id, section_type, sort_order, enabled, approved, validated)
values ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000101', 'hero', 0, true, true, true);
insert into public.media_assets (id, public_id, delivery_url, asset_type, width, height, alt_text, approved, validated)
values ('00000000-0000-4000-8000-000000000103', 'cms-test/hero', 'https://res.cloudinary.com/nanohome/image/upload/cms-test-hero.jpg', 'image', 1600, 900, 'CMS test hero', true, true);
insert into public.hero_slides (id, section_id, desktop_media_id, title, approved, validated)
values ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000103', 'CMS test hero', true, true);
insert into public.hero_hotspots (id, hero_slide_id, variant_id, x_percent, y_percent)
values ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000031', 50, 50);
insert into public.page_sections (id, page_id, section_type, sort_order, enabled, approved, validated)
values ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000101', 'product_curation', 1, true, true, true);
insert into public.product_curations (id, section_id, title, approved, validated)
values ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000106', 'Draft curation', false, false);
insert into public.product_curation_items (id, curation_id, variant_id, sort_order)
values ('00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000031', 0);

SET LOCAL ROLE anon;
SELECT is(
  (select count(*) from public.hero_hotspots where id = '00000000-0000-4000-8000-000000000105'),
  1::bigint,
  'anon can read a hotspot whose published ancestors are visible'
);
SELECT is(
  (select count(*) from public.product_curations where id = '00000000-0000-4000-8000-000000000107'),
  0::bigint,
  'anon cannot read a draft curation under a published page section'
);
SELECT is(
  (select count(*) from public.product_curation_items where id = '00000000-0000-4000-8000-000000000108'),
  0::bigint,
  'anon cannot read an item whose curation is draft'
);
RESET ROLE;

UPDATE public.site_pages set approved = false where id = '00000000-0000-4000-8000-000000000101';
SET LOCAL ROLE anon;
SELECT is(
  (select count(*) from public.hero_hotspots where id = '00000000-0000-4000-8000-000000000105'),
  0::bigint,
  'anon cannot read a hotspot after its page becomes unpublished'
);
RESET ROLE;

SELECT lives_ok(
  $$
    set local role nocodb_catalog_editor;
    update public.variants set description = 'NocoDB editorial update' where id = '00000000-0000-4000-8000-000000000031';
    reset role;
  $$,
  'NocoDB role can update an allowed variant editorial column'
);

SELECT throws_ok(
  $$
    set local role nocodb_catalog_editor;
    update public.variants set price = 11 where id = '00000000-0000-4000-8000-000000000031';
  $$,
  '42501',
  NULL,
  'NocoDB role cannot update MISA-owned variant price'
);
SELECT throws_ok(
  $$
    set local role nocodb_catalog_editor;
    update public.variants set stock = 1 where id = '00000000-0000-4000-8000-000000000031';
  $$,
  '42501',
  NULL,
  'NocoDB role cannot update MISA-owned variant stock'
);
SELECT throws_ok(
  $$
    set local role nocodb_catalog_editor;
    update public.variants set on_sale = true where id = '00000000-0000-4000-8000-000000000031';
  $$,
  '42501',
  NULL,
  'NocoDB role cannot update MISA-owned sale state'
);

RESET ROLE;
SELECT ok(
  (select stock is null from public.variants where id = :'variant_id_1'),
  'catalog fixture starts with no stock value'
);
SELECT lives_ok(
  $$
    set local role service_role;
    update public.variants set stock = 1 where id = '00000000-0000-4000-8000-000000000031';
    reset role;
  $$,
  'service role can update MISA-owned variant stock'
);
SELECT is(
  (select stock from public.variants where id = :'variant_id_1'),
  1::numeric,
  'service role stock update persists'
);

SELECT * FROM finish();
ROLLBACK;
