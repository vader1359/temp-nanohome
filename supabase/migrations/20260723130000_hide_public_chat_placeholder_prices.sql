-- Preserve the original bounded search implementation behind a private helper,
-- then normalize storefront placeholder prices at the public-chat boundary.
alter function public.search_public_chat_catalog(text, integer)
  rename to search_public_chat_catalog_before_placeholder_price_guard;

revoke all on function public.search_public_chat_catalog_before_placeholder_price_guard(text, integer)
  from public, anon, authenticated, service_role;

create function public.search_public_chat_catalog(
  search_query text,
  result_limit integer default 5
)
returns table (
  id uuid,
  name text,
  name_vi text,
  name_ko text,
  description text,
  description_vi text,
  description_ko text,
  designer_description text,
  designer_description_vi text,
  designer_description_ko text,
  short_name text,
  short_name_vi text,
  short_name_ko text,
  slug text,
  slug_vi text,
  slug_ko text,
  packshot_url text,
  gallery_urls text[],
  finish text,
  finish_vi text,
  finish_ko text,
  size text,
  product_name_denorm text,
  product_line text,
  designer_name text,
  filter_category text,
  filter_product_line text,
  cldr_media_lifestyle_1 text,
  cldr_media_lifestyle_2 text,
  media_long text,
  media_closeup text,
  product_id uuid,
  product_name text,
  localized_product_name text,
  brand_name text,
  public_price numeric,
  public_price_mode text,
  public_stock_state text,
  is_recommendable boolean,
  is_current boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
set statement_timeout = '4s'
as $$
  select
    searched.id,
    searched.name,
    searched.name_vi,
    searched.name_ko,
    searched.description,
    searched.description_vi,
    searched.description_ko,
    searched.designer_description,
    searched.designer_description_vi,
    searched.designer_description_ko,
    searched.short_name,
    searched.short_name_vi,
    searched.short_name_ko,
    searched.slug,
    searched.slug_vi,
    searched.slug_ko,
    searched.packshot_url,
    searched.gallery_urls,
    searched.finish,
    searched.finish_vi,
    searched.finish_ko,
    searched.size,
    searched.product_name_denorm,
    searched.product_line,
    searched.designer_name,
    searched.filter_category,
    searched.filter_product_line,
    searched.cldr_media_lifestyle_1,
    searched.cldr_media_lifestyle_2,
    searched.media_long,
    searched.media_closeup,
    searched.product_id,
    searched.product_name,
    searched.localized_product_name,
    searched.brand_name,
    case
      when searched.public_price_mode = 'fixed'
        and searched.public_price between 0 and 1 then null
      else searched.public_price
    end as public_price,
    case
      when searched.public_price_mode = 'fixed'
        and searched.public_price between 0 and 1 then 'contact'
      else searched.public_price_mode
    end as public_price_mode,
    searched.public_stock_state,
    searched.is_recommendable,
    searched.is_current
  from public.search_public_chat_catalog_before_placeholder_price_guard(
    search_query,
    result_limit
  ) as searched;
$$;

comment on function public.search_public_chat_catalog(text, integer) is
  'Bounded multilingual public catalog search; zero and one price placeholders are contact-only.';

revoke all on function public.search_public_chat_catalog(text, integer)
  from public, anon, authenticated;
grant execute on function public.search_public_chat_catalog(text, integer)
  to anon, authenticated, service_role;
