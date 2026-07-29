create table public.customer_event_rate_limits (
  session_id uuid not null references public.customer_sessions(id) on delete cascade,
  window_started_at timestamp with time zone not null,
  event_count integer not null default 1,
  expires_at timestamp with time zone not null,
  primary key (session_id, window_started_at),
  check (event_count between 1 and 60),
  check (expires_at > window_started_at)
);

create index customer_event_rate_limits_expiry_idx
  on public.customer_event_rate_limits(expires_at);

alter table public.customer_event_rate_limits enable row level security;
revoke all on public.customer_event_rate_limits from public, anon, authenticated;
grant all on public.customer_event_rate_limits to service_role;

create index customer_identity_ledger_latest_idx
  on public.customer_identity_ledger(visitor_id, recorded_at desc, id desc);

create or replace function public.bind_verified_customer_identity(
  p_visitor_id uuid,
  p_session_id uuid,
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_latest_kind text;
  v_latest_user_id uuid;
  v_latest_session_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_visitor_id::text, 0));

  if not exists (
    select 1
    from public.customer_visitors v
    join public.customer_sessions s on s.visitor_id = v.id
    where v.id = p_visitor_id
      and s.id = p_session_id
      and v.revoked_at is null
      and s.revoked_at is null
      and (v.expires_at is null or v.expires_at > now())
      and (s.expires_at is null or s.expires_at > now())
  ) then
    raise exception 'visitor and session are inactive';
  end if;

  if p_user_id is null or not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'verified auth user is required';
  end if;

  select l.identity_kind, l.user_id, l.session_id
  into v_latest_kind, v_latest_user_id, v_latest_session_id
  from public.customer_identity_ledger l
  where l.visitor_id = p_visitor_id
  order by l.recorded_at desc, l.id desc
  limit 1;

  if v_latest_kind = 'authenticated'
    and v_latest_user_id = p_user_id
    and v_latest_session_id = p_session_id then
    return 'unchanged';
  end if;

  if v_latest_kind = 'authenticated' and v_latest_user_id is distinct from p_user_id then
    delete from public.customer_preferences where visitor_id = p_visitor_id;
    delete from public.customer_recent_entities where visitor_id = p_visitor_id;
    delete from public.customer_affinities where visitor_id = p_visitor_id;
    delete from public.personalization_decisions where visitor_id = p_visitor_id;
  end if;

  insert into public.customer_identity_ledger(
    visitor_id, session_id, user_id, identity_kind, identity_value_hash, source
  ) values (
    p_visitor_id,
    p_session_id,
    p_user_id,
    'authenticated',
    encode(extensions.digest(p_user_id::text, 'sha256'), 'hex'),
    'verified_supabase_auth'
  );

  return 'bound';
end;
$$;

create or replace function public.clear_verified_customer_identity(
  p_visitor_id uuid,
  p_session_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_latest_kind text;
  v_latest_session_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_visitor_id::text, 0));

  if not exists (
    select 1
    from public.customer_visitors v
    join public.customer_sessions s on s.visitor_id = v.id
    where v.id = p_visitor_id
      and s.id = p_session_id
      and v.revoked_at is null
      and s.revoked_at is null
      and (v.expires_at is null or v.expires_at > now())
      and (s.expires_at is null or s.expires_at > now())
  ) then
    raise exception 'visitor and session are inactive';
  end if;

  select l.identity_kind, l.session_id
  into v_latest_kind, v_latest_session_id
  from public.customer_identity_ledger l
  where l.visitor_id = p_visitor_id
  order by l.recorded_at desc, l.id desc
  limit 1;

  if v_latest_kind = 'anonymous' and v_latest_session_id = p_session_id then
    return 'unchanged';
  end if;

  if v_latest_kind = 'authenticated' then
    delete from public.customer_preferences where visitor_id = p_visitor_id;
    delete from public.customer_recent_entities where visitor_id = p_visitor_id;
    delete from public.customer_affinities where visitor_id = p_visitor_id;
    delete from public.personalization_decisions where visitor_id = p_visitor_id;
  end if;

  insert into public.customer_identity_ledger(
    visitor_id, session_id, user_id, identity_kind, identity_value_hash, source
  ) values (
    p_visitor_id,
    p_session_id,
    null,
    'anonymous',
    encode(extensions.digest(p_visitor_id::text || ':' || p_session_id::text, 'sha256'), 'hex'),
    'website_auth_state'
  );

  return 'cleared';
end;
$$;

create or replace function public.project_product_view_to_recent_entities()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_interacted_at timestamp with time zone := new.received_at;
begin
  if new.event_name <> 'product_viewed'
    or new.product_id is null
    or new.variant_id is null
    or not exists (
      select 1
      from public.customer_consent_current c
      where c.visitor_id = new.visitor_id
        and c.analytics
        and c.personalization
        and c.withdrawn_at is null
    )
    or not exists (
      select 1
      from public.variants v
      where v.id::text = new.variant_id
        and v.product_id::text = new.product_id
    ) then
    return new;
  end if;

  insert into public.customer_recent_entities(
    visitor_id, entity_type, entity_id, interaction_count,
    first_interacted_at, last_interacted_at, expires_at, deleted_at
  ) values
    (new.visitor_id, 'product', new.product_id::uuid, 1, v_interacted_at, v_interacted_at, v_interacted_at + interval '30 days', null),
    (new.visitor_id, 'variant', new.variant_id::uuid, 1, v_interacted_at, v_interacted_at, v_interacted_at + interval '30 days', null)
  on conflict (visitor_id, entity_type, entity_id) where deleted_at is null do update set
    interaction_count = least(100, public.customer_recent_entities.interaction_count + 1),
    last_interacted_at = greatest(public.customer_recent_entities.last_interacted_at, excluded.last_interacted_at),
    expires_at = greatest(public.customer_recent_entities.last_interacted_at, excluded.last_interacted_at) + interval '30 days',
    deleted_at = null;

  with ranked as (
    select r.id,
      row_number() over (order by r.last_interacted_at desc, r.id desc) as position
    from public.customer_recent_entities r
    where r.visitor_id = new.visitor_id and r.deleted_at is null
  )
  update public.customer_recent_entities r
  set deleted_at = v_interacted_at
  from ranked
  where r.id = ranked.id and ranked.position > 50;

  return new;
end;
$$;

drop trigger if exists customer_events_project_recent_entities on public.customer_events;
create trigger customer_events_project_recent_entities
after insert on public.customer_events
for each row execute function public.project_product_view_to_recent_entities();

create or replace function public.append_customer_event(
  p_visitor_id uuid,
  p_session_id uuid,
  p_event jsonb,
  p_received_at timestamp with time zone
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_key text;
  v_key_hash text;
  v_properties jsonb;
  v_purposes text[];
  v_now timestamp with time zone := clock_timestamp();
  v_window timestamp with time zone;
  v_rate_count integer;
begin
  if not exists (
    select 1
    from public.customer_visitors v
    join public.customer_sessions s on s.visitor_id = v.id
    where v.id = p_visitor_id
      and s.id = p_session_id
      and v.revoked_at is null
      and s.revoked_at is null
      and (v.expires_at is null or v.expires_at > v_now)
      and (s.expires_at is null or s.expires_at > v_now)
  ) then
    raise exception 'visitor and session are inactive';
  end if;

  if p_event is null or jsonb_typeof(p_event) <> 'object'
    or exists (select 1 from jsonb_object_keys(p_event) k where k not in ('name', 'idempotencyKey', 'properties')) then
    raise exception 'unknown event keys are not allowed';
  end if;

  v_name := p_event->>'name';
  v_key := p_event->>'idempotencyKey';
  v_properties := p_event->'properties';
  if v_key is null or v_key !~ '^[A-Za-z0-9_-]{16,128}$' then
    raise exception 'idempotency key is invalid';
  end if;
  if v_properties is null or jsonb_typeof(v_properties) <> 'object'
    or exists (
      select 1 from jsonb_object_keys(v_properties) k
      where k not in (
        'routeKey', 'locale', 'productId', 'variantId', 'placement', 'filterKeys',
        'resultCountBucket', 'requestId', 'itemIds', 'itemId', 'rank',
        'sourcePlacement', 'cartId', 'itemCountBucket', 'preferenceKeys',
        'analysisId', 'correctionFlags'
      )
    ) then
    raise exception 'unknown event properties are not allowed';
  end if;
  if v_name is null or v_name not in (
    'page_viewed', 'product_viewed', 'search_submitted',
    'recommendation_impression', 'recommendation_clicked', 'cart_item_added',
    'checkout_started', 'preference_updated', 'room_analysis_confirmed'
  ) then
    raise exception 'unknown event name';
  end if;

  if v_name = 'product_viewed' then
    if jsonb_typeof(v_properties->'productId') <> 'string'
      or jsonb_typeof(v_properties->'variantId') <> 'string'
      or v_properties->>'placement' <> 'pdp'
      or not exists (
        select 1
        from public.variants v
        where v.id = (v_properties->>'variantId')::uuid
          and v.product_id = (v_properties->>'productId')::uuid
      ) then
      raise exception 'canonical product and variant are required';
    end if;
  end if;

  v_purposes := case v_name
    when 'cart_item_added' then array['essential']
    when 'checkout_started' then array['essential']
    when 'recommendation_impression' then array['personalization']
    when 'recommendation_clicked' then array['personalization']
    when 'preference_updated' then array['personalization']
    when 'room_analysis_confirmed' then array['room_image_processing', 'personalization']
    when 'product_viewed' then array['analytics', 'personalization']
    else array['analytics']
  end;
  if not ('essential' = any(v_purposes)) and not exists (
    select 1
    from public.customer_consent_current c
    where c.visitor_id = p_visitor_id
      and c.withdrawn_at is null
      and (not ('analytics' = any(v_purposes)) or c.analytics)
      and (not ('personalization' = any(v_purposes)) or c.personalization)
      and (not ('room_image_processing' = any(v_purposes)) or c.room_image_processing)
  ) then
    raise exception 'required consent purpose is not granted';
  end if;

  v_key_hash := encode(extensions.digest(v_key, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_session_id::text || ':' || v_key_hash, 0));
  if exists (
    select 1 from public.customer_events e
    where e.session_id = p_session_id and e.idempotency_key_hash = v_key_hash
  ) then
    return 'duplicate';
  end if;

  delete from public.customer_event_rate_limits
  where session_id = p_session_id and expires_at <= v_now;
  v_window := date_trunc('minute', v_now);
  insert into public.customer_event_rate_limits(session_id, window_started_at, event_count, expires_at)
  values (p_session_id, v_window, 1, v_window + interval '2 minutes')
  on conflict (session_id, window_started_at) do update set
    event_count = public.customer_event_rate_limits.event_count + 1,
    expires_at = excluded.expires_at
  where public.customer_event_rate_limits.event_count < 60
  returning event_count into v_rate_count;
  if v_rate_count is null then
    return 'rate_limited';
  end if;

  insert into public.customer_events(
    visitor_id, session_id, event_name, idempotency_key_hash, occurred_at, received_at,
    route_key, locale, product_id, variant_id, placement, filter_keys,
    result_count_bucket, request_id, item_ids, item_id, rank, source_placement,
    cart_id, item_count_bucket, preference_keys, analysis_id, correction_flags
  ) values (
    p_visitor_id, p_session_id, v_name, v_key_hash, v_now, v_now,
    v_properties->>'routeKey', v_properties->>'locale',
    nullif(v_properties->>'productId', '')::uuid,
    nullif(v_properties->>'variantId', '')::uuid,
    v_properties->>'placement',
    case when v_properties ? 'filterKeys' then array(select jsonb_array_elements_text(v_properties->'filterKeys')) end,
    v_properties->>'resultCountBucket', v_properties->>'requestId',
    case when v_properties ? 'itemIds' then array(select jsonb_array_elements_text(v_properties->'itemIds'))::uuid[] end,
    nullif(v_properties->>'itemId', '')::uuid,
    nullif(v_properties->>'rank', '')::integer,
    v_properties->>'sourcePlacement',
    nullif(v_properties->>'cartId', '')::uuid,
    v_properties->>'itemCountBucket',
    case when v_properties ? 'preferenceKeys' then array(select jsonb_array_elements_text(v_properties->'preferenceKeys')) end,
    v_properties->>'analysisId',
    case when v_properties ? 'correctionFlags' then array(select jsonb_array_elements_text(v_properties->'correctionFlags')) end
  );

  return 'accepted';
end;
$$;

revoke all on function public.bind_verified_customer_identity(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.clear_verified_customer_identity(uuid, uuid) from public, anon, authenticated;
revoke all on function public.project_product_view_to_recent_entities() from public, anon, authenticated;
revoke all on function public.append_customer_event(uuid, uuid, jsonb, timestamp with time zone) from public, anon, authenticated;
grant execute on function public.bind_verified_customer_identity(uuid, uuid, uuid) to service_role;
grant execute on function public.clear_verified_customer_identity(uuid, uuid) to service_role;
grant execute on function public.append_customer_event(uuid, uuid, jsonb, timestamp with time zone) to service_role;

comment on table public.customer_event_rate_limits is 'Durable per-session fixed-window event limits shared by all serverless instances.';
comment on function public.bind_verified_customer_identity(uuid, uuid, uuid) is 'Binds a server-verified Supabase auth user to an active website identity and purges prior-account personalization.';
comment on function public.clear_verified_customer_identity(uuid, uuid) is 'Records logout as anonymous and clears visitor-scoped personalization to prevent account crossover.';
comment on function public.project_product_view_to_recent_entities() is 'Projects consented canonical PDP views into at most 50 short-lived entity references.';
