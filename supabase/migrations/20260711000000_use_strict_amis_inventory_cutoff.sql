create or replace function public.apply_amis_inventory_sync(
  p_mode text,
  p_completed_at timestamptz,
  p_baseline_lines jsonb,
  p_orders jsonb,
  p_order_lines jsonb,
  p_watermark timestamptz,
  p_expected_baseline_id uuid,
  p_expected_watermark timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_baseline_id uuid;
  v_items_processed integer;
begin
  perform pg_advisory_xact_lock(hashtext('amis_inventory_sync'));

  if p_mode = 'baseline' then
    select active_baseline_id into v_baseline_id from amis_inventory_sync_state where sync_key = 'inventory';
    if v_baseline_id is distinct from p_expected_baseline_id then
      raise exception 'AMIS inventory baseline changed during physical stock sync';
    end if;
    insert into amis_inventory_baselines (completed_at) values (p_completed_at) returning id into v_baseline_id;
    insert into amis_inventory_baseline_lines (baseline_id, sku, stock)
    select v_baseline_id, line.sku, line.stock
    from jsonb_to_recordset(p_baseline_lines) as line(sku text, stock numeric);
    update amis_inventory_baselines set is_active = false where is_active;
    update amis_inventory_baselines set is_active = true where id = v_baseline_id;
    insert into amis_inventory_sync_state (sync_key, active_baseline_id, sale_order_watermark)
    values ('inventory', v_baseline_id, null)
    on conflict (sync_key) do update set active_baseline_id = excluded.active_baseline_id, sale_order_watermark = null;
  elsif p_mode = 'sale_orders' then
    select active_baseline_id into v_baseline_id from amis_inventory_sync_state where sync_key = 'inventory';
    if v_baseline_id is null then raise exception 'No active AMIS inventory baseline'; end if;
    if v_baseline_id is distinct from p_expected_baseline_id then raise exception 'AMIS inventory baseline changed during Sale Order sync'; end if;
    if (select sale_order_watermark from amis_inventory_sync_state where sync_key = 'inventory') is distinct from p_expected_watermark then
      raise exception 'AMIS Sale Order watermark changed during sync';
    end if;
    update amis_sale_order_lines set is_deleted = true
    where amis_order_id in (select amis_order_id from jsonb_to_recordset(p_orders) as item(amis_order_id bigint));
    insert into amis_sale_orders (amis_order_id, modified_date, approved_status, approved_date, status, is_deleted)
    select item.amis_order_id, item.modified_date, item.approved_status, item.approved_date, item.status, item.is_deleted
    from jsonb_to_recordset(p_orders) as item(amis_order_id bigint, modified_date timestamptz, approved_status text, approved_date timestamptz, status text, is_deleted boolean)
    on conflict (amis_order_id) do update set modified_date = excluded.modified_date, approved_status = excluded.approved_status,
      approved_date = excluded.approved_date, status = excluded.status, is_deleted = excluded.is_deleted;
    insert into amis_sale_order_lines (amis_line_id, amis_order_id, sku, amount, produced_quantity, total_amount_delivered, is_note_row, is_deleted)
    select item.amis_line_id, item.amis_order_id, item.sku, item.amount, item.produced_quantity, item.total_amount_delivered, item.is_note_row, false
    from jsonb_to_recordset(p_order_lines) as item(amis_line_id bigint, amis_order_id bigint, sku text, amount numeric, produced_quantity numeric, total_amount_delivered numeric, is_note_row boolean)
    on conflict (amis_line_id) do update set amis_order_id = excluded.amis_order_id, sku = excluded.sku, amount = excluded.amount,
      produced_quantity = excluded.produced_quantity, total_amount_delivered = excluded.total_amount_delivered,
      is_note_row = excluded.is_note_row, is_deleted = false;
    update amis_inventory_sync_state set sale_order_watermark = p_watermark where sync_key = 'inventory';
  else
    raise exception 'Unsupported AMIS inventory sync mode';
  end if;

  with available as (
    select baseline.sku, baseline.stock - coalesce(sum(line.amount) filter (
      where sale_order.approved_status = 'Đã duyệt' and not sale_order.is_deleted and not line.is_deleted
        and not line.is_note_row and nullif(btrim(line.sku), '') is not null and line.amount is not null
        and sale_order.approved_date > active.completed_at
    ), 0) as stock
    from amis_inventory_baseline_lines baseline
    join amis_inventory_baselines active on active.id = baseline.baseline_id
    left join amis_sale_order_lines line on line.sku = baseline.sku
    left join amis_sale_orders sale_order on sale_order.amis_order_id = line.amis_order_id
    where baseline.baseline_id = v_baseline_id
    group by baseline.sku, baseline.stock, active.completed_at
  ), unique_variants as (
    select sku, (array_agg(id order by id))[1] as id
    from variants
    where sku is not null
    group by sku
    having count(*) = 1
  ), updated as (
    update variants variant set stock = available.stock
    from available join unique_variants on unique_variants.sku = available.sku
    where variant.id = unique_variants.id and variant.stock is distinct from available.stock
    returning variant.id
  ) select count(*) into v_items_processed from updated;

  return jsonb_build_object('items_processed', v_items_processed);
end;
$$;

revoke all on function public.apply_amis_inventory_sync(text, timestamptz, jsonb, jsonb, jsonb, timestamptz, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_amis_inventory_sync(text, timestamptz, jsonb, jsonb, jsonb, timestamptz, uuid, timestamptz) to service_role;
