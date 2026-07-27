-- Keep the full eligibility read model server-only. Public chat consumes the
-- bounded projection returned by search_public_chat_catalog instead.
revoke all on public.catalog_eligibility from public, anon, authenticated;
grant select on public.catalog_eligibility to service_role;

-- The return shape remains backward compatible with the original public RPC:
-- all original columns stay in the same order and the coarse public fields
-- required to render a card are appended.
drop function if exists public.search_public_chat_catalog(text, integer);

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
  with normalized_input as (
    select lower(btrim(left(coalesce(search_query, ''), 240))) as term
  ),
  normalized_query as (
    select
      term,
      case
        when term ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then term::uuid
        else null
      end as identifier
    from normalized_input
  ),
  candidates as (
    select
      variant.id,
      case
        when variant.id = query.identifier
          or variant.product_id = query.identifier then 1100
        when lower(coalesce(variant.sku, '')) = query.term then 1000
        when lower(coalesce(variant.name_vi, '')) = query.term
          or lower(coalesce(variant.name, '')) = query.term
          or lower(coalesce(variant.name_ko, '')) = query.term then 900
        when strpos(lower(coalesce(variant.name_vi, '')), query.term) > 0
          or strpos(lower(coalesce(variant.name, '')), query.term) > 0
          or strpos(lower(coalesce(variant.name_ko, '')), query.term) > 0
          or strpos(lower(coalesce(variant.product_name_denorm, '')), query.term) > 0 then 800
        when strpos(lower(coalesce(variant.filter_category, '')), query.term) > 0
          or strpos(lower(coalesce(variant.filter_sub_category, '')), query.term) > 0 then 700
        when strpos(
          lower(array_to_string(coalesce(variant.filter_room, array[]::text[]), ' ')),
          query.term
        ) > 0
          or strpos(
            lower(array_to_string(coalesce(variant.filter_room_vi, array[]::text[]), ' ')),
            query.term
          ) > 0
          or strpos(
            lower(array_to_string(coalesce(variant.filter_room_ko, array[]::text[]), ' ')),
            query.term
          ) > 0 then 650
        when strpos(lower(coalesce(variant.filter_brand, '')), query.term) > 0
          or strpos(lower(coalesce(variant.brand_name_denorm, '')), query.term) > 0 then 600
        else 100
      end as match_tier,
      case
        when query.identifier is not null then 1
        else greatest(
          word_similarity(query.term, lower(coalesce(variant.name_vi, ''))),
          word_similarity(query.term, lower(coalesce(variant.name, ''))),
          word_similarity(query.term, lower(coalesce(variant.name_ko, ''))),
          word_similarity(query.term, lower(coalesce(variant.product_name_denorm, ''))),
          word_similarity(query.term, lower(coalesce(variant.sku, ''))) * 0.95,
          word_similarity(query.term, lower(coalesce(variant.filter_category, ''))) * 0.80,
          word_similarity(query.term, lower(coalesce(variant.filter_sub_category, ''))) * 0.75,
          word_similarity(
            query.term,
            lower(array_to_string(coalesce(variant.filter_room, array[]::text[]), ' '))
          ) * 0.75,
          word_similarity(
            query.term,
            lower(array_to_string(coalesce(variant.filter_room_vi, array[]::text[]), ' '))
          ) * 0.75,
          word_similarity(
            query.term,
            lower(array_to_string(coalesce(variant.filter_room_ko, array[]::text[]), ' '))
          ) * 0.75,
          word_similarity(query.term, lower(coalesce(variant.filter_brand, ''))) * 0.70,
          word_similarity(query.term, lower(coalesce(variant.brand_name_denorm, ''))) * 0.70
        )
      end as search_rank,
      eligibility.has_fresh_stock,
      eligibility.product_id,
      eligibility.product_name,
      eligibility.localized_product_name,
      eligibility.brand_name,
      case
        when eligibility.price_mode = 'fixed'
          and eligibility.price is not null
          and eligibility.price >= 0 then eligibility.price
        else null
      end as public_price,
      case
        when eligibility.price_mode = 'fixed'
          and eligibility.price is not null
          and eligibility.price >= 0 then 'fixed'
        when eligibility.price_mode = 'contact' then 'contact'
        else 'unavailable'
      end as public_price_mode,
      case
        when eligibility.has_fresh_stock then 'available'
        else 'unknown'
      end as public_stock_state,
      coalesce(eligibility.recommendation, false) as is_recommendable,
      coalesce(eligibility.catalog_approved_validated, false) as is_current
    from public.variants as variant
    join public.catalog_eligibility as eligibility
      on eligibility.variant_id = variant.id
    cross join normalized_query as query
    where query.term <> ''
      and coalesce(eligibility.recommendation, false) = true
      and coalesce(eligibility.catalog_approved_validated, false) = true
      and coalesce(eligibility.has_supported_media, false) = true
      and (
        (
          query.identifier is not null
          and (
            variant.id = query.identifier
            or variant.product_id = query.identifier
          )
        )
        or (
          query.identifier is null
          and (
            char_length(query.term) >= 2
            or lower(coalesce(variant.sku, '')) = query.term
          )
          and (
            lower(coalesce(variant.sku, '')) = query.term
            or strpos(lower(coalesce(variant.sku, '')), query.term) > 0
            or strpos(lower(coalesce(variant.name_vi, '')), query.term) > 0
            or strpos(lower(coalesce(variant.name, '')), query.term) > 0
            or strpos(lower(coalesce(variant.name_ko, '')), query.term) > 0
            or strpos(lower(coalesce(variant.product_name_denorm, '')), query.term) > 0
            or strpos(lower(coalesce(variant.filter_category, '')), query.term) > 0
            or strpos(lower(coalesce(variant.filter_sub_category, '')), query.term) > 0
            or strpos(lower(coalesce(variant.filter_brand, '')), query.term) > 0
            or strpos(lower(coalesce(variant.brand_name_denorm, '')), query.term) > 0
            or strpos(
              lower(array_to_string(coalesce(variant.filter_room, array[]::text[]), ' ')),
              query.term
            ) > 0
            or strpos(
              lower(array_to_string(coalesce(variant.filter_room_vi, array[]::text[]), ' ')),
              query.term
            ) > 0
            or strpos(
              lower(array_to_string(coalesce(variant.filter_room_ko, array[]::text[]), ' ')),
              query.term
            ) > 0
            or word_similarity(query.term, lower(coalesce(variant.name_vi, ''))) > 0.18
            or word_similarity(query.term, lower(coalesce(variant.name, ''))) > 0.18
            or word_similarity(query.term, lower(coalesce(variant.name_ko, ''))) > 0.18
            or word_similarity(query.term, lower(coalesce(variant.product_name_denorm, ''))) > 0.18
            or word_similarity(query.term, lower(coalesce(variant.sku, ''))) > 0.18
            or word_similarity(query.term, lower(coalesce(variant.filter_category, ''))) > 0.18
            or word_similarity(query.term, lower(coalesce(variant.filter_sub_category, ''))) > 0.18
            or word_similarity(
              query.term,
              lower(array_to_string(coalesce(variant.filter_room, array[]::text[]), ' '))
            ) > 0.18
            or word_similarity(
              query.term,
              lower(array_to_string(coalesce(variant.filter_room_vi, array[]::text[]), ' '))
            ) > 0.18
            or word_similarity(
              query.term,
              lower(array_to_string(coalesce(variant.filter_room_ko, array[]::text[]), ' '))
            ) > 0.18
            or word_similarity(query.term, lower(coalesce(variant.filter_brand, ''))) > 0.18
            or word_similarity(query.term, lower(coalesce(variant.brand_name_denorm, ''))) > 0.18
          )
        )
      )
  )
  select
    variant.id,
    variant.name,
    variant.name_vi,
    variant.name_ko,
    variant.description,
    variant.description_vi,
    variant.description_ko,
    variant.designer_description,
    variant.designer_description_vi,
    variant.designer_description_ko,
    variant.short_name,
    variant.short_name_vi,
    variant.short_name_ko,
    variant.slug,
    variant.slug_vi,
    variant.slug_ko,
    variant.packshot_url,
    coalesce(variant.gallery_urls, array[]::text[]),
    variant.finish,
    variant.finish_vi,
    variant.finish_ko,
    variant.size,
    variant.product_name_denorm,
    variant.product_line,
    variant.designer_name,
    variant.filter_category,
    variant.filter_product_line,
    variant.cldr_media_lifestyle_1,
    variant.cldr_media_lifestyle_2,
    variant.media_long,
    variant.media_closeup,
    candidates.product_id,
    candidates.product_name,
    candidates.localized_product_name,
    candidates.brand_name,
    candidates.public_price,
    candidates.public_price_mode,
    candidates.public_stock_state,
    candidates.is_recommendable,
    candidates.is_current
  from candidates
  join public.variants as variant on variant.id = candidates.id
  order by
    candidates.match_tier desc,
    candidates.search_rank desc,
    candidates.has_fresh_stock desc,
    variant.priority asc nulls last,
    variant.id asc
  limit least(greatest(coalesce(result_limit, 5), 1), 12);
$$;

comment on function public.search_public_chat_catalog(text, integer) is
  'Bounded multilingual catalog search returning only approved public chat fields and coarse availability.';

revoke all on function public.search_public_chat_catalog(text, integer)
  from public, anon, authenticated;
grant execute on function public.search_public_chat_catalog(text, integer)
  to anon, authenticated, service_role;
