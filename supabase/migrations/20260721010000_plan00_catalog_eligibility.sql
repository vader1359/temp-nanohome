create or replace view public.catalog_eligibility as
with source_rows as (
  select
    variant.id as variant_id,
    variant.product_id,
    variant.sku,
    variant.slug as variant_slug,
    variant.name as variant_name,
    variant.name_vi,
    variant.name_ko,
    variant.price,
    variant.stock,
    variant.source_updated_at,
    coalesce(variant.approved, false) as variant_approved,
    coalesce(variant.validated, false) as variant_validated,
    product.name as product_name,
    product.name_vi as product_name_vi,
    product.name_ko as product_name_ko,
    product.slug as product_slug,
    coalesce(product.approved, false) as product_approved,
    coalesce(product.validated, false) as product_validated,
    brand.id as brand_id,
    brand.name as brand_name,
    brand.slug as brand_slug,
    coalesce(brand.approved, false) as brand_approved,
    coalesce(brand.validated, false) as brand_validated,
    coalesce(
      nullif(btrim(variant.packshot_url), ''),
      nullif(btrim(variant.gallery_urls[1]), ''),
      nullif(btrim(product.media_image_url), '')
    ) as image_url,
    coalesce(
      nullif(lower(btrim(variant.raw ->> 'price_mode')), ''),
      nullif(lower(btrim(variant.raw ->> 'priceMode')), ''),
      case
        when variant.price is null then 'contact'
        when variant.price = 0 and lower(coalesce(brand.slug, '')) = 'moooi' then 'contact'
        else 'fixed'
      end
    ) as raw_price_mode,
    active.completed_at as amis_completed_at,
    baseline_line.sku is not null as amis_sku_present
  from public.variants as variant
  left join public.products as product on product.id = variant.product_id
  left join public.brands as brand on brand.id = variant.brand_id
  left join public.amis_inventory_sync_state as sync_state on sync_state.sync_key = 'inventory'
  left join public.amis_inventory_baselines as active
    on active.id = sync_state.active_baseline_id and active.is_active
  left join public.amis_inventory_baseline_lines as baseline_line
    on baseline_line.baseline_id = active.id and baseline_line.sku = variant.sku
), normalized as (
  select
    source_rows.*,
    raw_price_mode in ('fixed', 'contact', 'deposit', 'unavailable') as known_price_mode,
    case
      when raw_price_mode in ('fixed', 'contact', 'deposit', 'unavailable') then raw_price_mode
      else 'unavailable'
    end as price_mode,
    coalesce(image_url ~* '^https?://', false) as has_supported_media,
    amis_sku_present
      and amis_completed_at >= now() - interval '24 hours'
      and (source_updated_at is null or amis_completed_at >= source_updated_at)
      and coalesce(stock, 0) > 0 as has_fresh_stock,
    lower(coalesce(brand_slug, '')) = 'moooi'
      or lower(coalesce(brand_name, '')) = 'moooi'
      or lower(coalesce(sku, '')) like 'moooi%' as hidden_brand_sku
  from source_rows
), evaluated as (
  select
    normalized.*,
    variant_approved and variant_validated
      and product_approved and product_validated
      and brand_approved and brand_validated as catalog_approved_validated,
    array_remove(array[
      case when not variant_approved then 'variant_not_approved' end,
      case when not variant_validated then 'variant_not_validated' end,
      case when not product_approved then 'product_not_approved' end,
      case when not product_validated then 'product_not_validated' end,
      case when not brand_approved then 'brand_not_approved' end,
      case when not brand_validated then 'brand_not_validated' end,
      case when not has_supported_media then 'media_missing_or_unsupported' end,
      case when not has_fresh_stock then 'stock_missing_or_stale' end,
      case when hidden_brand_sku then 'hidden_brand_sku' end,
      case when not known_price_mode then 'price_mode_unknown' end,
      case when price is null then 'price_missing' end,
      case when price_mode = 'unavailable' then 'price_unavailable' end
    ], null) as reason_codes
  from normalized
)
select
  variant_id,
  product_id,
  brand_id,
  sku,
  variant_slug,
  variant_name,
  coalesce(nullif(name_vi, ''), nullif(name_ko, ''), variant_name) as localized_name,
  product_slug,
  product_name,
  coalesce(nullif(product_name_vi, ''), nullif(product_name_ko, ''), product_name) as localized_product_name,
  brand_slug,
  brand_name,
  image_url,
  price,
  stock,
  price_mode,
  has_fresh_stock,
  has_supported_media,
  catalog_approved_validated,
  hidden_brand_sku,
  reason_codes,
   catalog_approved_validated and has_supported_media and has_fresh_stock
     and not hidden_brand_sku and price_mode = 'fixed' and price is not null as storefront,
   catalog_approved_validated and has_supported_media and not hidden_brand_sku as recommendation,
   catalog_approved_validated and has_supported_media and not hidden_brand_sku as visual_match,
   catalog_approved_validated and has_fresh_stock and not hidden_brand_sku
     and price_mode = 'fixed' and price is not null as cart,
   catalog_approved_validated and has_fresh_stock and price_mode = 'fixed'
     and price is not null and not hidden_brand_sku as payment
from evaluated;

comment on view public.catalog_eligibility is
  'Plan 00 conservative catalog eligibility read model; source catalog rows are not rewritten.';

grant select on public.catalog_eligibility to anon, authenticated;
