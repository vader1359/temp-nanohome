-- Structured public-chat catalog retrieval.  Product-family and all explicit
-- facets are hard predicates; ranking is only applied after the safe set is
-- formed.  This RPC returns the same public card projection as v1 plus the
-- typed facets needed by the application-side defense and observability.
create extension if not exists pg_trgm;

create index if not exists variants_public_chat_filter_category_idx
  on public.variants (filter_category, filter_sub_category);

create index if not exists variants_public_chat_filter_brand_idx
  on public.variants (filter_brand);

create index if not exists variants_public_chat_filter_product_line_idx
  on public.variants (filter_product_line);

create index if not exists variants_public_chat_filter_category_normalized_idx
  on public.variants (lower(coalesce(filter_category, '')));

create index if not exists variants_public_chat_filter_sub_category_normalized_idx
  on public.variants (lower(coalesce(filter_sub_category, '')));

create index if not exists variants_public_chat_filter_brand_normalized_idx
  on public.variants (lower(coalesce(filter_brand, '')));

create index if not exists variants_public_chat_filter_product_line_normalized_idx
  on public.variants (lower(coalesce(filter_product_line, '')));

create index if not exists variants_public_chat_filter_room_gin_idx
  on public.variants using gin (filter_room);

create index if not exists variants_public_chat_filter_room_vi_gin_idx
  on public.variants using gin (filter_room_vi);

create index if not exists variants_public_chat_filter_room_ko_gin_idx
  on public.variants using gin (filter_room_ko);

drop function if exists public.search_public_chat_catalog_v2(
  text,
  text[],
  text[],
  text[],
  text[],
  text[],
  text[],
  text[],
  text[],
  text[],
  numeric,
  numeric,
  text,
  text,
  integer
);

create function public.search_public_chat_catalog_v2(
  search_text text default null,
  product_family_keys text[] default '{}'::text[],
  subtype_keys text[] default '{}'::text[],
  category_keys text[] default '{}'::text[],
  collection_keys text[] default '{}'::text[],
  room_keys text[] default '{}'::text[],
  brand_keys text[] default '{}'::text[],
  designer_keys text[] default '{}'::text[],
  material_keys text[] default '{}'::text[],
  color_keys text[] default '{}'::text[],
  min_price numeric default null,
  max_price numeric default null,
  availability_mode text default 'include_unknown',
  sort_mode text default 'relevance',
  result_limit integer default 8
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
  filter_sub_category text,
  filter_brand text,
  filter_room text[],
  filter_room_vi text[],
  filter_room_ko text[],
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
  with input as (
    select
      lower(btrim(left(coalesce(search_text, ''), 240))) as search_term,
      coalesce(product_family_keys, '{}'::text[]) as family_keys,
      coalesce(subtype_keys, '{}'::text[]) as subtype_keys,
      coalesce(category_keys, '{}'::text[]) as category_keys,
      coalesce(collection_keys, '{}'::text[]) as collection_keys,
      coalesce(room_keys, '{}'::text[]) as room_keys,
      coalesce(brand_keys, '{}'::text[]) as brand_keys,
      coalesce(designer_keys, '{}'::text[]) as designer_keys,
      coalesce(material_keys, '{}'::text[]) as material_keys,
      coalesce(color_keys, '{}'::text[]) as color_keys,
      min_price as requested_min_price,
      max_price as requested_max_price,
      lower(coalesce(nullif(btrim(availability_mode), ''), 'include_unknown')) as availability,
      lower(coalesce(nullif(btrim(sort_mode), ''), 'relevance')) as sort,
      least(greatest(coalesce(result_limit, 8), 1), 8) as bounded_limit
  ), eligible_variants as (
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
      coalesce(variant.gallery_urls, '{}'::text[]) as gallery_urls,
      variant.finish,
      variant.finish_vi,
      variant.finish_ko,
      variant.size,
      variant.product_name_denorm,
      variant.product_line,
      variant.designer_name,
      variant.filter_category,
      variant.filter_product_line,
      variant.filter_sub_category,
      variant.filter_brand,
      coalesce(variant.filter_room, '{}'::text[]) as filter_room,
      coalesce(variant.filter_room_vi, '{}'::text[]) as filter_room_vi,
      coalesce(variant.filter_room_ko, '{}'::text[]) as filter_room_ko,
      variant.cldr_media_lifestyle_1,
      variant.cldr_media_lifestyle_2,
      variant.media_long,
      variant.media_closeup,
      variant.sku,
      variant.product_id,
      variant.priority,
      eligibility.product_name,
      eligibility.localized_product_name,
      eligibility.brand_name,
      eligibility.price as eligibility_price,
      eligibility.price_mode as eligibility_price_mode,
      coalesce(eligibility.has_fresh_stock, false) as has_fresh_stock,
      coalesce(eligibility.recommendation, false) as is_recommendable,
      coalesce(eligibility.catalog_approved_validated, false) as is_current,
      lower(concat_ws(
        ' ',
        variant.filter_category,
        variant.filter_sub_category,
        variant.filter_product_line,
        variant.name,
        variant.name_vi,
        variant.name_ko
      )) as family_text,
      lower(concat_ws(
        ' ',
        variant.filter_category,
        variant.filter_sub_category,
        variant.filter_product_line
      )) as category_text,
      lower(concat_ws(
        ' ',
        variant.filter_product_line,
        variant.product_line,
        variant.name,
        variant.name_vi,
        variant.name_ko
      )) as collection_text,
      lower(concat_ws(
        ' ',
        array_to_string(coalesce(variant.filter_room, '{}'::text[]), ' '),
        array_to_string(coalesce(variant.filter_room_vi, '{}'::text[]), ' '),
        array_to_string(coalesce(variant.filter_room_ko, '{}'::text[]), ' ')
      )) as room_text,
      lower(concat_ws(
        ' ',
        variant.filter_brand,
        variant.brand_name_denorm,
        eligibility.brand_name
      )) as brand_text,
      lower(coalesce(variant.designer_name, '')) as designer_text,
      lower(concat_ws(
        ' ',
        variant.finish,
        variant.finish_vi,
        variant.finish_ko,
        variant.name,
        variant.name_vi,
        variant.name_ko,
        variant.description,
        variant.description_vi,
        variant.description_ko
      )) as attribute_text
    from public.variants as variant
    join public.catalog_eligibility as eligibility
      on eligibility.variant_id = variant.id
    where coalesce(eligibility.recommendation, false) = true
      and coalesce(eligibility.catalog_approved_validated, false) = true
      and coalesce(eligibility.has_supported_media, false) = true
  ), filtered as (
    select
      candidate.*,
      input.search_term,
      input.availability,
      input.sort,
      input.bounded_limit,
      case
        when candidate.eligibility_price_mode = 'fixed'
          and candidate.eligibility_price is not null
          and candidate.eligibility_price > 1
          then candidate.eligibility_price
        else null
      end as public_price,
      case
        when candidate.eligibility_price_mode = 'fixed'
          and candidate.eligibility_price is not null
          and candidate.eligibility_price > 1 then 'fixed'
        when candidate.eligibility_price_mode = 'contact'
          or (candidate.eligibility_price_mode = 'fixed'
            and candidate.eligibility_price is not null
            and candidate.eligibility_price between 0 and 1) then 'contact'
        else 'unavailable'
      end as public_price_mode,
      case when candidate.has_fresh_stock then 'available' else 'unknown' end as public_stock_state
    from eligible_variants as candidate
    cross join input
    where (
        cardinality(input.family_keys) = 0
        or exists (
          select 1
          from unnest(input.family_keys) as wanted(key)
          where case wanted.key
            when 'table' then (
              (
                candidate.family_text ~ '(^|[^a-z])(table|tables)([^a-z]|$)'
                or candidate.family_text ~ '(^|[^a-z])bàn([^a-z]|$)'
                or candidate.family_text ~ '(^|[^a-z])ban([^a-z]|$)'
              )
              and candidate.family_text !~ '(^|[^a-z])(lamp|lamps|light|lights|đèn|den)([^a-z]|$)'
            )
            when 'desk' then (
              candidate.family_text ~ '(^|[^a-z])(desk|desks|workstation)([^a-z]|$)'
              or candidate.family_text ~ '(^|[^a-z])(bàn làm việc|ban lam viec)([^a-z]|$)'
            )
            when 'lamp' then candidate.family_text ~ '(^|[^a-z])(lamp|lamps|light|lights|đèn|den)([^a-z]|$)'
            when 'chair' then (
              candidate.family_text ~ '(^|[^a-z])(chair|chairs|ghế|ghe)([^a-z]|$)'
            )
            when 'sofa' then candidate.family_text ~ '(^|[^a-z])(sofa|sofas)([^a-z]|$)'
            when 'bed' then candidate.family_text ~ '(^|[^a-z])(bed|beds|giường|giuong)([^a-z]|$)'
            when 'cabinet' then (
              candidate.family_text ~ '(^|[^a-z])(cabinet|cabinets|storage|tủ|tu)([^a-z]|$)'
            )
            when 'mirror' then candidate.family_text ~ '(^|[^a-z])(mirror|mirrors|gương|guong)([^a-z]|$)'
            when 'vase' then candidate.family_text ~ '(^|[^a-z])(vase|vases|bình hoa|binh hoa)([^a-z]|$)'
            when 'rug' then candidate.family_text ~ '(^|[^a-z])(rug|rugs|thảm|tham)([^a-z]|$)'
            when 'cushion' then candidate.family_text ~ '(^|[^a-z])(cushion|cushions|gối|goi)([^a-z]|$)'
            when 'accessory' then candidate.family_text ~ '(^|[^a-z])(accessory|accessories|phụ kiện|phu kien|nến|nen)([^a-z]|$)'
            else position(replace(wanted.key, '_', ' ') in candidate.family_text) > 0
          end
        )
      )
      and (
        cardinality(input.subtype_keys) = 0
        or exists (
          select 1
          from unnest(input.subtype_keys) as wanted(key)
          where case wanted.key
            when 'dining_table' then (
              candidate.family_text ~ '(^|[^a-z])(dining table|dining tables|bàn ăn|ban an)([^a-z]|$)'
            )
            when 'coffee_table' then candidate.family_text ~ '(^|[^a-z])(coffee table|bàn cà phê|ban ca phe)([^a-z]|$)'
            when 'side_table' then candidate.family_text ~ '(^|[^a-z])(side table|bàn bên|ban ben)([^a-z]|$)'
            when 'console_table' then candidate.family_text ~ '(^|[^a-z])(console table|bàn console|ban console)([^a-z]|$)'
            when 'work_desk' then (
              candidate.family_text ~ '(^|[^a-z])(work desk|desk|bàn làm việc|ban lam viec)([^a-z]|$)'
            )
            when 'table_lamp' then (
              candidate.family_text ~ '(^|[^a-z])(table lamp|đèn bàn|den ban)([^a-z]|$)'
            )
            when 'dining_chair' then (
              candidate.family_text ~ '(^|[^a-z])(dining chair|ghế bàn ăn|ghe ban an)([^a-z]|$)'
            )
            when 'lounge_chair' then (
              candidate.family_text ~ '(^|[^a-z])(lounge chair|ghế lounge|ghe lounge)([^a-z]|$)'
            )
            else position(replace(wanted.key, '_', ' ') in candidate.family_text) > 0
          end
        )
      )
      and (
        cardinality(input.category_keys) = 0
        or exists (
          select 1
          from unnest(input.category_keys) as wanted(key)
          where case wanted.key
            when 'table' then candidate.category_text ~ '(^|[^a-z])(table|tables)([^a-z]|$)'
            when 'desk' then candidate.category_text ~ '(^|[^a-z])(desk|desks)([^a-z]|$)'
            when 'lamp' then candidate.category_text ~ '(^|[^a-z])(lamp|lamps|lighting|lights)([^a-z]|$)'
            when 'chair' then candidate.category_text ~ '(^|[^a-z])(chair|chairs)([^a-z]|$)'
            when 'sofa' then candidate.category_text ~ '(^|[^a-z])(sofa|sofas)([^a-z]|$)'
            when 'bed' then candidate.category_text ~ '(^|[^a-z])(bed|beds)([^a-z]|$)'
            when 'cabinet' then candidate.category_text ~ '(^|[^a-z])(cabinet|cabinets|storage)([^a-z]|$)'
            when 'mirror' then candidate.category_text ~ '(^|[^a-z])(mirror|mirrors)([^a-z]|$)'
            when 'vase' then candidate.category_text ~ '(^|[^a-z])(vase|vases)([^a-z]|$)'
            when 'rug' then candidate.category_text ~ '(^|[^a-z])(rug|rugs)([^a-z]|$)'
            when 'cushion' then candidate.category_text ~ '(^|[^a-z])(cushion|cushions)([^a-z]|$)'
            else position(replace(wanted.key, '_', ' ') in candidate.category_text) > 0
          end
        )
      )
      and (
        cardinality(input.collection_keys) = 0
        or exists (
          select 1
          from unnest(input.collection_keys) as wanted(key)
          where case wanted.key
            when 'lc' then candidate.collection_text ~ '(^|[^a-z])lc([^a-z]|$)'
              or candidate.collection_text ~ '(^|[^a-z])lc collection([^a-z]|$)'
            else position(replace(wanted.key, '_', ' ') in candidate.collection_text) > 0
          end
        )
      )
      and (
        cardinality(input.room_keys) = 0
        or exists (
          select 1
          from unnest(input.room_keys) as wanted(key)
          where case wanted.key
            when 'living' then candidate.room_text ~ '(^|[^a-z])(living|living room|phòng khách|phong khach)([^a-z]|$)'
            when 'dining' then candidate.room_text ~ '(^|[^a-z])(dining|dining room|phòng ăn|phong an)([^a-z]|$)'
            when 'bedroom' then candidate.room_text ~ '(^|[^a-z])(bedroom|bed room|phòng ngủ|phong ngu)([^a-z]|$)'
            when 'office' then candidate.room_text ~ '(^|[^a-z])(office|workspace|phòng làm việc|phong lam viec)([^a-z]|$)'
            when 'outdoor' then candidate.room_text ~ '(^|[^a-z])(outdoor|balcony|ban công|ban cong|ngoài trời|ngoai troi)([^a-z]|$)'
            else position(replace(wanted.key, '_', ' ') in candidate.room_text) > 0
          end
        )
      )
      and (
        cardinality(input.brand_keys) = 0
        or exists (
          select 1
          from unnest(input.brand_keys) as wanted(key)
          where position(replace(wanted.key, '_', ' ') in candidate.brand_text) > 0
        )
      )
      and (
        cardinality(input.designer_keys) = 0
        or exists (
          select 1
          from unnest(input.designer_keys) as wanted(key)
          where case wanted.key
            when 'le_corbusier' then candidate.designer_text like '%le corbusier%'
              or candidate.designer_text like '%lecorbusier%'
            else position(replace(wanted.key, '_', ' ') in candidate.designer_text) > 0
          end
        )
      )
      and (
        cardinality(input.material_keys) = 0
        or exists (
          select 1
          from unnest(input.material_keys) as wanted(key)
          where case wanted.key
            when 'leather' then candidate.attribute_text ~ '(^|[^a-z])(leather|da)([^a-z]|$)'
            when 'wood' then candidate.attribute_text ~ '(^|[^a-z])(wood|oak|gỗ|go)([^a-z]|$)'
            when 'metal' then candidate.attribute_text ~ '(^|[^a-z])(metal|steel|aluminum|kim loại|kim loai)([^a-z]|$)'
            when 'fabric' then candidate.attribute_text ~ '(^|[^a-z])(fabric|vải|vai)([^a-z]|$)'
            when 'marble' then candidate.attribute_text ~ '(^|[^a-z])(marble|đá hoa|da hoa)([^a-z]|$)'
            else position(replace(wanted.key, '_', ' ') in candidate.attribute_text) > 0
          end
        )
      )
      and (
        cardinality(input.color_keys) = 0
        or exists (
          select 1
          from unnest(input.color_keys) as wanted(key)
          where case wanted.key
            when 'black' then candidate.attribute_text ~ '(^|[^a-z])(black|màu đen|mau den|đen|den)([^a-z]|$)'
            else position(replace(wanted.key, '_', ' ') in candidate.attribute_text) > 0
          end
        )
      )
      and (
        input.availability <> 'available_only'
        or candidate.has_fresh_stock = true
      )
      and (
        input.sort not in ('price_asc', 'price_desc')
        or (
          candidate.eligibility_price_mode = 'fixed'
          and candidate.eligibility_price is not null
          and candidate.eligibility_price > 1
        )
      )
      and (
        (input.requested_min_price is null and input.requested_max_price is null)
        or (
          candidate.eligibility_price_mode = 'fixed'
          and candidate.eligibility_price is not null
          and candidate.eligibility_price > 1
          and (input.requested_min_price is null or candidate.eligibility_price >= input.requested_min_price)
          and (input.requested_max_price is null or candidate.eligibility_price <= input.requested_max_price)
        )
      )
      and (
        input.search_term = ''
        or lower(coalesce(candidate.sku, '')) = input.search_term
        or lower(candidate.id::text) = input.search_term
        or lower(coalesce(candidate.product_id::text, '')) = input.search_term
        or position(input.search_term in lower(coalesce(candidate.name, ''))) > 0
        or position(input.search_term in lower(coalesce(candidate.name_vi, ''))) > 0
        or position(input.search_term in lower(coalesce(candidate.name_ko, ''))) > 0
        or position(input.search_term in candidate.family_text) > 0
        or position(input.search_term in candidate.brand_text) > 0
        or position(input.search_term in candidate.designer_text) > 0
        or position(input.search_term in candidate.attribute_text) > 0
        or word_similarity(input.search_term, candidate.family_text) > 0.18
        or word_similarity(input.search_term, candidate.brand_text) > 0.18
        or word_similarity(input.search_term, candidate.designer_text) > 0.18
      )
  ), ranked as (
    select
      filtered.*,
      case
        when filtered.search_term = '' then 0
        when lower(coalesce(filtered.sku, '')) = filtered.search_term
          or lower(filtered.id::text) = filtered.search_term
          or lower(coalesce(filtered.product_id::text, '')) = filtered.search_term then 1100
        when position(filtered.search_term in filtered.family_text) > 0 then 900
        when position(filtered.search_term in filtered.brand_text) > 0
          or position(filtered.search_term in filtered.designer_text) > 0 then 800
        when position(filtered.search_term in filtered.attribute_text) > 0 then 700
        else 100
      end as match_tier,
      case
        when filtered.search_term = '' then 0::real
        else greatest(
          word_similarity(filtered.search_term, filtered.family_text),
          word_similarity(filtered.search_term, filtered.brand_text) * 0.85,
          word_similarity(filtered.search_term, filtered.designer_text) * 0.80,
          word_similarity(filtered.search_term, filtered.attribute_text) * 0.65
        )
      end as search_rank
    from filtered
  )
  select
    ranked.id,
    ranked.name,
    ranked.name_vi,
    ranked.name_ko,
    ranked.description,
    ranked.description_vi,
    ranked.description_ko,
    ranked.designer_description,
    ranked.designer_description_vi,
    ranked.designer_description_ko,
    ranked.short_name,
    ranked.short_name_vi,
    ranked.short_name_ko,
    ranked.slug,
    ranked.slug_vi,
    ranked.slug_ko,
    ranked.packshot_url,
    ranked.gallery_urls,
    ranked.finish,
    ranked.finish_vi,
    ranked.finish_ko,
    ranked.size,
    ranked.product_name_denorm,
    ranked.product_line,
    ranked.designer_name,
    ranked.filter_category,
    ranked.filter_product_line,
    ranked.filter_sub_category,
    ranked.filter_brand,
    ranked.filter_room,
    ranked.filter_room_vi,
    ranked.filter_room_ko,
    ranked.cldr_media_lifestyle_1,
    ranked.cldr_media_lifestyle_2,
    ranked.media_long,
    ranked.media_closeup,
    ranked.product_id,
    ranked.product_name,
    ranked.localized_product_name,
    ranked.brand_name,
    ranked.public_price,
    ranked.public_price_mode,
    ranked.public_stock_state,
    ranked.is_recommendable,
    ranked.is_current
  from ranked
  order by
    case when ranked.sort = 'price_asc' then ranked.public_price end asc nulls last,
    case when ranked.sort = 'price_desc' then ranked.public_price end desc nulls last,
    ranked.match_tier desc,
    ranked.search_rank desc,
    ranked.has_fresh_stock desc,
    ranked.priority asc nulls last,
    ranked.id asc
  limit (select bounded_limit from input);
$$;

comment on function public.search_public_chat_catalog_v2(
  text,
  text[],
  text[],
  text[],
  text[],
  text[],
  text[],
  text[],
  text[],
  text[],
  numeric,
  numeric,
  text,
  text,
  integer
) is
  'Read-only structured public AI-chat catalog search; family and facet filters are hard predicates before ranking and limit.';

revoke all on function public.search_public_chat_catalog_v2(
  text,
  text[],
  text[],
  text[],
  text[],
  text[],
  text[],
  text[],
  text[],
  text[],
  numeric,
  numeric,
  text,
  text,
  integer
) from public, anon, authenticated, service_role;

grant execute on function public.search_public_chat_catalog_v2(
  text,
  text[],
  text[],
  text[],
  text[],
  text[],
  text[],
  text[],
  text[],
  text[],
  numeric,
  numeric,
  text,
  text,
  integer
) to anon, authenticated, service_role;
