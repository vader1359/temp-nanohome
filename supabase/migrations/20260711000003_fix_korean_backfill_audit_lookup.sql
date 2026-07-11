create or replace function public.apply_korean_backfill_chunk(
  p_run_id uuid,
  p_updates jsonb
)
returns table (
  input_ordinal integer,
  target_table text,
  target_column text,
  target_id uuid,
  outcome text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_update jsonb;
  v_ordinal integer;
  v_table text;
  v_column text;
  v_id uuid;
  v_value jsonb;
  v_previous jsonb;
  v_text text;
  v_array text[];
  v_exists boolean;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service_role required'; end if;
  if jsonb_typeof(p_updates) <> 'array' or jsonb_array_length(p_updates) not between 1 and 250 then raise exception 'updates must contain 1 to 250 records'; end if;
  perform 1 from private.korean_backfill_runs where id = p_run_id and status = 'running';
  if not found then raise exception 'running Korean backfill run not found'; end if;
  for v_update, v_ordinal in select value, ordinality::integer - 1 from jsonb_array_elements(p_updates) with ordinality as updates(value, ordinality) loop
    if jsonb_typeof(v_update) <> 'object' or not (v_update ? 'id' and v_update ? 'table' and v_update ? 'column' and v_update ? 'value') then raise exception 'invalid Korean backfill update'; end if;
    v_table := v_update ->> 'table'; v_column := v_update ->> 'column'; v_id := (v_update ->> 'id')::uuid; v_value := v_update -> 'value';
    if (v_table, v_column) not in (
      ('brands', 'description_ko'), ('brands', 'origin_ko'), ('catalogs', 'origin_ko'), ('categories', 'name_ko'), ('news', 'title_ko'),
      ('products', 'name_ko'), ('products', 'slug_ko'), ('products', 'description_ko'),
      ('variants', 'name_ko'), ('variants', 'short_name_ko'), ('variants', 'slug_ko'), ('variants', 'description_ko'), ('variants', 'meta_title_ko'), ('variants', 'meta_description_ko'),
      ('variants', 'finish_ko'), ('variants', 'designer_description_ko'), ('variants', 'brand_origin_ko'), ('variants', 'cldr_media_closeup_alt_ko'), ('variants', 'cldr_media_lifestyle_1_alt_ko'), ('variants', 'cldr_media_lifestyle_2_alt_ko'), ('variants', 'cldr_media_long_alt_ko'), ('variants', 'cldr_packshot_alt_ko'), ('variants', 'filter_room_ko')
    ) then raise exception 'unapproved Korean backfill target'; end if;
    if v_table = 'variants' and v_column = 'filter_room_ko' then
      if jsonb_typeof(v_value) <> 'array' or jsonb_array_length(v_value) = 0 or exists (select 1 from jsonb_array_elements_text(v_value) as room where btrim(room) = '') then raise exception 'filter_room_ko must be a nonempty string array'; end if;
      select array_agg(room) into v_array from jsonb_array_elements_text(v_value) as room;
    else
      if jsonb_typeof(v_value) <> 'string' or nullif(btrim(v_value #>> '{}'), '') is null then raise exception 'Korean backfill text must be nonempty'; end if;
      v_text := v_value #>> '{}';
    end if;
    select exists(select 1 from private.korean_backfill_writes as writes where writes.run_id = p_run_id and writes.target_table = v_table and writes.target_column = v_column and writes.target_id = v_id) into v_exists;
    if v_exists then input_ordinal := v_ordinal; target_table := v_table; target_column := v_column; target_id := v_id; outcome := 'skipped_already_applied'; return next; continue; end if;
    execute format('select to_jsonb(%1$I) from public.%2$I where id = $1 for update', v_column, v_table) into v_previous using v_id;
    if not found then input_ordinal := v_ordinal; target_table := v_table; target_column := v_column; target_id := v_id; outcome := 'missing'; return next; continue; end if;
    if (v_table = 'variants' and v_column = 'filter_room_ko' and coalesce(jsonb_array_length(v_previous), 0) > 0) or (not (v_table = 'variants' and v_column = 'filter_room_ko') and nullif(btrim(v_previous #>> '{}'), '') is not null) then input_ordinal := v_ordinal; target_table := v_table; target_column := v_column; target_id := v_id; outcome := 'skipped_nonempty'; return next; continue; end if;
    if v_table = 'variants' and v_column = 'filter_room_ko' then update public.variants set filter_room_ko = v_array where id = v_id; else execute format('update public.%1$I set %2$I = $1 where id = $2', v_table, v_column) using v_text, v_id; end if;
    insert into private.korean_backfill_writes (run_id, input_ordinal, target_table, target_column, target_id, previous_value, applied_value) values (p_run_id, v_ordinal, v_table, v_column, v_id, coalesce(v_previous, 'null'::jsonb), v_value);
    input_ordinal := v_ordinal; target_table := v_table; target_column := v_column; target_id := v_id; outcome := 'applied'; return next;
  end loop;
end;
$$;
