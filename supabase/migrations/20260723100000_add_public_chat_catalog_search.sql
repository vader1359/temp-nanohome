-- Search only the catalog rows that are safe to surface in public AI chat.
-- Eligibility is applied before ranking and limiting so a page of hidden or
-- incomplete variants cannot crowd out valid recommendations.
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
  media_closeup text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with normalized_query as (
    select lower(left(btrim(coalesce(search_query, '')), 240)) as term
  ),
  candidates as (
    select
      variant.id,
      case
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
      greatest(
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
      ) as search_rank,
      eligibility.has_fresh_stock
    from public.variants as variant
    join public.catalog_eligibility as eligibility
      on eligibility.variant_id = variant.id
    cross join normalized_query as query
    where query.term <> ''
      and coalesce(eligibility.recommendation, false) = true
      and coalesce(eligibility.catalog_approved_validated, false) = true
      and coalesce(eligibility.has_supported_media, false) = true
      and (
        strpos(lower(coalesce(variant.sku, '')), query.term) > 0
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
    variant.media_closeup
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
  'Read-only multilingual catalog search for public AI chat; eligibility is applied before ranking and limit.';

revoke all on function public.search_public_chat_catalog(text, integer)
  from public, anon, authenticated;
grant execute on function public.search_public_chat_catalog(text, integer)
  to anon, authenticated, service_role;
