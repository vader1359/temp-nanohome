-- Product search uses pg_trgm only. It intentionally does not depend on the
-- much larger PGroonga indexes that were previously created for this table.
create extension if not exists pg_trgm;

create index if not exists variants_fuzzy_filter_category_trgm_idx
  on public.variants using gin (filter_category gin_trgm_ops);

create index if not exists variants_fuzzy_filter_sub_category_trgm_idx
  on public.variants using gin (filter_sub_category gin_trgm_ops);

create index if not exists variants_fuzzy_filter_brand_trgm_idx
  on public.variants using gin (filter_brand gin_trgm_ops);

create index if not exists variants_fuzzy_designer_name_trgm_idx
  on public.variants using gin (designer_name gin_trgm_ops);

create or replace function public.search_variant_products_fuzzy(
  search_query text,
  brand_filters text[] default null,
  category_filters text[] default null,
  sub_category_filters text[] default null,
  room_filters text[] default null,
  status_filter text default null,
  category_id_filter uuid default null,
  exclude_variant_id uuid default null,
  sort_key text default 'priority',
  result_limit integer default 24,
  result_offset integer default 0
)
returns setof public.variants
language sql
stable
security definer
set search_path = public
as $$
  with scored as (
    select
      v.id,
      case
        -- Exact identifiers and product names must always come first.
        when lower(coalesce(v.sku, '')) = lower(search_query) then 1000
        when lower(coalesce(v.name_vi, '')) = lower(search_query)
          or lower(coalesce(v.name, '')) = lower(search_query)
          or lower(coalesce(v.name_ko, '')) = lower(search_query) then 900
        when coalesce(v.name_vi, '') ilike '%' || search_query || '%'
          or coalesce(v.name, '') ilike '%' || search_query || '%'
          or coalesce(v.name_ko, '') ilike '%' || search_query || '%' then 800
        when coalesce(v.sku, '') ilike '%' || search_query || '%' then 700
        when coalesce(v.filter_category, '') ilike '%' || search_query || '%' then 600
        when coalesce(v.filter_sub_category, '') ilike '%' || search_query || '%' then 500
        when coalesce(v.filter_brand, '') ilike '%' || search_query || '%'
          or coalesce(v.brand_name_denorm, '') ilike '%' || search_query || '%' then 400
        when coalesce(v.designer_name, '') ilike '%' || search_query || '%' then 300
        else 100
      end as match_tier,
      greatest(
        word_similarity(search_query, coalesce(v.name_vi, '')) * 1.00,
        word_similarity(search_query, coalesce(v.name, '')) * 1.00,
        word_similarity(search_query, coalesce(v.name_ko, '')) * 1.00,
        word_similarity(search_query, coalesce(v.sku, '')) * 0.95,
        word_similarity(search_query, coalesce(v.filter_category, '')) * 0.75,
        word_similarity(search_query, coalesce(v.filter_sub_category, '')) * 0.70,
        word_similarity(search_query, coalesce(v.filter_brand, '')) * 0.65,
        word_similarity(search_query, coalesce(v.brand_name_denorm, '')) * 0.65,
        word_similarity(search_query, coalesce(v.designer_name, '')) * 0.60,
        word_similarity(search_query, coalesce(v.finish_vi, '')) * 0.45,
        word_similarity(search_query, coalesce(v.finish, '')) * 0.45,
        word_similarity(search_query, coalesce(v.finish_ko, '')) * 0.45
      ) as search_rank
    from public.variants v
    where v.validated = true
      and v.approved = true
      and v.filter_brand is distinct from 'moooi'
      and (brand_filters is null or v.filter_brand = any(brand_filters))
      and (category_filters is null or v.filter_category = any(category_filters))
      and (sub_category_filters is null or v.filter_sub_category = any(sub_category_filters))
      and (room_filters is null or v.filter_room && room_filters)
      and (category_id_filter is null or v.category_id = category_id_filter)
      and (exclude_variant_id is null or v.id <> exclude_variant_id)
      and (
        status_filter is null
        or (status_filter = 'in_stock' and (v.in_stock = true or v.sku ilike 'USMUS%'))
        or (status_filter = 'sale' and v.on_sale = true)
        or (status_filter = 'out_of_stock' and v.in_stock = false)
        or (status_filter = 'new_arrival' and v.filter_is_new_arrival = true)
      )
      and (
        coalesce(v.name_vi, '') ilike '%' || search_query || '%'
        or coalesce(v.name, '') ilike '%' || search_query || '%'
        or coalesce(v.name_ko, '') ilike '%' || search_query || '%'
        or coalesce(v.sku, '') ilike '%' || search_query || '%'
        or coalesce(v.finish_vi, '') ilike '%' || search_query || '%'
        or coalesce(v.finish, '') ilike '%' || search_query || '%'
        or coalesce(v.finish_ko, '') ilike '%' || search_query || '%'
        or coalesce(v.filter_category, '') ilike '%' || search_query || '%'
        or coalesce(v.filter_sub_category, '') ilike '%' || search_query || '%'
        or coalesce(v.filter_brand, '') ilike '%' || search_query || '%'
        or coalesce(v.brand_name_denorm, '') ilike '%' || search_query || '%'
        or coalesce(v.designer_name, '') ilike '%' || search_query || '%'
        or word_similarity(search_query, coalesce(v.name_vi, '')) > 0.18
        or word_similarity(search_query, coalesce(v.name, '')) > 0.18
        or word_similarity(search_query, coalesce(v.name_ko, '')) > 0.18
        or word_similarity(search_query, coalesce(v.sku, '')) > 0.18
        or word_similarity(search_query, coalesce(v.filter_category, '')) > 0.18
        or word_similarity(search_query, coalesce(v.filter_sub_category, '')) > 0.18
        or word_similarity(search_query, coalesce(v.filter_brand, '')) > 0.18
        or word_similarity(search_query, coalesce(v.brand_name_denorm, '')) > 0.18
        or word_similarity(search_query, coalesce(v.designer_name, '')) > 0.18
        or word_similarity(search_query, coalesce(v.finish_vi, '')) > 0.18
        or word_similarity(search_query, coalesce(v.finish, '')) > 0.18
        or word_similarity(search_query, coalesce(v.finish_ko, '')) > 0.18
      )
  )
  select v.*
  from scored
  join public.variants v on v.id = scored.id
  order by
    scored.match_tier desc,
    scored.search_rank desc,
    case when sort_key = 'priority' then v.in_stock end desc nulls last,
    case when sort_key = 'priority' then v.filter_is_new_arrival end desc nulls last,
    case when sort_key = 'priority' then v.priority end asc nulls last,
    case when sort_key = 'price_asc' then v.price end asc nulls last,
    case when sort_key = 'price_desc' then v.price end desc nulls last,
    case when sort_key = 'newest' then v.source_created_at end desc nulls last,
    v.id asc
  limit greatest(result_limit, 1)
  offset greatest(result_offset, 0);
$$;

create or replace function public.search_variant_products_fuzzy_count(
  search_query text,
  brand_filters text[] default null,
  category_filters text[] default null,
  sub_category_filters text[] default null,
  room_filters text[] default null,
  status_filter text default null,
  category_id_filter uuid default null,
  exclude_variant_id uuid default null
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.variants v
  where v.validated = true
    and v.approved = true
    and v.filter_brand is distinct from 'moooi'
    and (brand_filters is null or v.filter_brand = any(brand_filters))
    and (category_filters is null or v.filter_category = any(category_filters))
    and (sub_category_filters is null or v.filter_sub_category = any(sub_category_filters))
    and (room_filters is null or v.filter_room && room_filters)
    and (category_id_filter is null or v.category_id = category_id_filter)
    and (exclude_variant_id is null or v.id <> exclude_variant_id)
    and (
      status_filter is null
      or (status_filter = 'in_stock' and (v.in_stock = true or v.sku ilike 'USMUS%'))
      or (status_filter = 'sale' and v.on_sale = true)
      or (status_filter = 'out_of_stock' and v.in_stock = false)
      or (status_filter = 'new_arrival' and v.filter_is_new_arrival = true)
    )
    and (
      coalesce(v.name_vi, '') ilike '%' || search_query || '%'
      or coalesce(v.name, '') ilike '%' || search_query || '%'
      or coalesce(v.name_ko, '') ilike '%' || search_query || '%'
      or coalesce(v.sku, '') ilike '%' || search_query || '%'
      or coalesce(v.finish_vi, '') ilike '%' || search_query || '%'
      or coalesce(v.finish, '') ilike '%' || search_query || '%'
      or coalesce(v.finish_ko, '') ilike '%' || search_query || '%'
      or coalesce(v.filter_category, '') ilike '%' || search_query || '%'
      or coalesce(v.filter_sub_category, '') ilike '%' || search_query || '%'
      or coalesce(v.filter_brand, '') ilike '%' || search_query || '%'
      or coalesce(v.brand_name_denorm, '') ilike '%' || search_query || '%'
      or coalesce(v.designer_name, '') ilike '%' || search_query || '%'
      or word_similarity(search_query, coalesce(v.name_vi, '')) > 0.18
      or word_similarity(search_query, coalesce(v.name, '')) > 0.18
      or word_similarity(search_query, coalesce(v.name_ko, '')) > 0.18
      or word_similarity(search_query, coalesce(v.sku, '')) > 0.18
      or word_similarity(search_query, coalesce(v.filter_category, '')) > 0.18
      or word_similarity(search_query, coalesce(v.filter_sub_category, '')) > 0.18
      or word_similarity(search_query, coalesce(v.filter_brand, '')) > 0.18
      or word_similarity(search_query, coalesce(v.brand_name_denorm, '')) > 0.18
      or word_similarity(search_query, coalesce(v.designer_name, '')) > 0.18
      or word_similarity(search_query, coalesce(v.finish_vi, '')) > 0.18
      or word_similarity(search_query, coalesce(v.finish, '')) > 0.18
      or word_similarity(search_query, coalesce(v.finish_ko, '')) > 0.18
    );
$$;
