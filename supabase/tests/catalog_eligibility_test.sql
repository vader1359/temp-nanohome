begin;

\ir fixtures.sql
\ir ../seed.sql

set local role postgres;

-- Given: an active AMIS baseline has a known, recent stock snapshot.
insert into public.amis_inventory_baselines (id, completed_at, is_active)
values ('00000000-0000-4000-8000-000000000101', now(), true);
insert into public.amis_inventory_baseline_lines (baseline_id, sku, stock)
select '00000000-0000-4000-8000-000000000101', sku, 10
from public.variants
where sku is not null;
insert into public.amis_inventory_sync_state (sync_key, active_baseline_id)
values ('inventory', '00000000-0000-4000-8000-000000000101');

-- Given: individual catalog defects are represented without rewriting source rows.
update public.variants
set source_updated_at = now() + interval '2 days'
where id = :'variant_id_3';
update public.variants
set packshot_url = null, gallery_urls = '{}'
where id = :'variant_id_6';
update public.variants
set price = null
where id = :'variant_id_7';
update public.variants
set sku = 'moooi-test-005'
where id = :'variant_id_5';
update public.variants
set stock = 10, packshot_url = 'https://cdn.example.test/variant-1.jpg'
where id = :'variant_id_1';

select plan(15);

-- When: the catalog eligibility view evaluates the approved and validated chain.
-- Then: approval and validation remain separate, conservative gates.
select is(
  (select catalog_approved_validated from public.catalog_eligibility where variant_id = :'variant_id_8'),
  false,
  'unapproved variant is not catalog eligible'
);
select is(
  (select catalog_approved_validated from public.catalog_eligibility where product_id = :'prod_id_5' limit 1),
  false,
  'unvalidated product is not catalog eligible'
);

-- When: the brand SKU is a hidden Moooi SKU.
-- Then: it is excluded from storefront and recommendation capabilities.
select is(
  (select hidden_brand_sku from public.catalog_eligibility where variant_id = :'variant_id_5'),
  true,
  'Moooi SKU is marked hidden'
);
select is(
  (select storefront from public.catalog_eligibility where variant_id = :'variant_id_5'),
  false,
  'Moooi SKU is not storefront eligible'
);

-- When: a variant has no supported media URL.
-- Then: visual capabilities and storefront visibility are disabled.
select is(
  (select has_supported_media from public.catalog_eligibility where variant_id = :'variant_id_6'),
  false,
  'missing image is detected'
);
select is(
  (select visual_match from public.catalog_eligibility where variant_id = :'variant_id_6'),
  false,
  'missing image disables visual match'
);

-- When: a variant has no price.
-- Then: its price mode is contact and the reason code is explicit.
select is(
  (select price_mode from public.catalog_eligibility where variant_id = :'variant_id_7'),
  'contact',
  'absent price infers contact mode'
);
select ok(
  (select reason_codes @> array['price_missing']::text[]
   from public.catalog_eligibility where variant_id = :'variant_id_7'),
  'absent price exposes price_missing reason code'
);

-- When: AMIS freshness is older than the source row update.
-- Then: stale stock blocks storefront and payment.
select is(
  (select has_fresh_stock from public.catalog_eligibility where variant_id = :'variant_id_3'),
  false,
  'stock is stale when AMIS snapshot predates source update'
);
select is(
  (select payment from public.catalog_eligibility where variant_id = :'variant_id_3'),
  false,
  'stale stock disables payment'
);

select is(
  (select has_fresh_stock from public.catalog_eligibility where variant_id = :'variant_id_2'),
  false,
  'zero stock is not fresh positive stock'
);

-- When: the requested locale is absent.
-- Then: the localized read model falls back to the next available locale.
select is(
  (select localized_name from public.catalog_eligibility where variant_id = :'variant_id_1'),
  '테스트 옵션 1',
  'locale fallback uses Korean variant name'
);

-- When: all conservative storefront gates pass for a fixed-price variant.
-- Then: storefront and payment capabilities are enabled.
select is(
  (select price_mode from public.catalog_eligibility where variant_id = :'variant_id_1'),
  'fixed',
  'numeric price infers fixed mode'
);
select is(
  (select storefront from public.catalog_eligibility where variant_id = :'variant_id_1'),
  true,
  'approved variant with fresh stock and media is storefront eligible'
);
select is(
  (select payment from public.catalog_eligibility where variant_id = :'variant_id_1'),
  true,
  'fixed-price variant with fresh stock is payment eligible'
);

select * from finish();
rollback;
