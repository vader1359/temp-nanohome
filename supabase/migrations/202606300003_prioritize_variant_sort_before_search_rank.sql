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
      greatest(
        word_similarity(search_query, coalesce(v.name_vi, '')),
        word_similarity(search_query, coalesce(v.name, '')),
        word_similarity(search_query, coalesce(v.sku, '')),
        word_similarity(search_query, coalesce(v.finish_vi, '')),
        word_similarity(search_query, coalesce(v.finish, '')),
        word_similarity(search_query, coalesce(v.brand_name_denorm, ''))
      ) as search_rank
    from public.variants v
    where v.validated = true
      and v.approved = true
      and (brand_filters is null or v.filter_brand = any(brand_filters))
      and (category_filters is null or v.filter_category = any(category_filters))
      and (sub_category_filters is null or v.filter_sub_category = any(sub_category_filters))
      and (room_filters is null or v.filter_room && room_filters)
      and (category_id_filter is null or v.category_id = category_id_filter)
      and (exclude_variant_id is null or v.id <> exclude_variant_id)
      and (
        status_filter is null
        or (status_filter = 'in_stock' and v.in_stock = true)
        or (status_filter = 'sale' and v.on_sale = true)
        or (status_filter = 'out_of_stock' and v.in_stock = false)
      )
      and (
        coalesce(v.name_vi, '') ilike '%' || search_query || '%'
        or coalesce(v.name, '') ilike '%' || search_query || '%'
        or coalesce(v.sku, '') ilike '%' || search_query || '%'
        or coalesce(v.finish_vi, '') ilike '%' || search_query || '%'
        or coalesce(v.finish, '') ilike '%' || search_query || '%'
        or coalesce(v.brand_name_denorm, '') ilike '%' || search_query || '%'
        or word_similarity(search_query, coalesce(v.name_vi, '')) > 0.18
        or word_similarity(search_query, coalesce(v.name, '')) > 0.18
        or word_similarity(search_query, coalesce(v.sku, '')) > 0.18
        or word_similarity(search_query, coalesce(v.finish_vi, '')) > 0.18
        or word_similarity(search_query, coalesce(v.finish, '')) > 0.18
        or word_similarity(search_query, coalesce(v.brand_name_denorm, '')) > 0.18
      )
  )
  select v.*
  from scored
  join public.variants v on v.id = scored.id
  order by
    case when sort_key = 'priority' then v.in_stock end desc nulls last,
    case when sort_key = 'priority' then v.filter_is_new_arrival end desc nulls last,
    case when sort_key = 'priority' then v.priority end asc nulls last,
    case when sort_key = 'priority' then scored.search_rank end desc nulls last,
    case when sort_key = 'price_asc' then v.price end asc nulls last,
    case when sort_key = 'price_desc' then v.price end desc nulls last,
    case when sort_key = 'newest' then v.source_created_at end desc nulls last,
    v.id asc
  limit greatest(result_limit, 1)
  offset greatest(result_offset, 0);
$$;
