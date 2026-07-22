alter table public.customer_subject_deletion_queue
  add column if not exists session_id uuid,
  add column if not exists visitor_created_at timestamptz;

create or replace function public.resolve_customer_identity_v2(p_visitor_token_hash text, p_session_token_hash text)
returns table(visitor_id uuid, session_id uuid, status text)
language sql security definer set search_path = public as $$
  select v.id, s.id,
    case when v.revoked_at is not null or s.revoked_at is not null
      or (v.expires_at is not null and v.expires_at <= now())
      or (s.expires_at is not null and s.expires_at <= now()) then 'inactive' else 'active' end
  from public.customer_visitors v
  join public.customer_sessions s on s.visitor_id = v.id
  where v.visitor_token_hash = p_visitor_token_hash and s.session_token_hash = p_session_token_hash;
$$;

create or replace function public.bootstrap_customer_identity_v2(p_visitor_token_hash text, p_session_token_hash text)
returns table(visitor_id uuid, session_id uuid, status text)
language plpgsql security definer set search_path = public as $$
declare v_id uuid; s_id uuid;
begin
  if nullif(p_visitor_token_hash, '') is null or nullif(p_session_token_hash, '') is null then raise exception 'identity token hashes are required'; end if;
  select v.id into v_id from public.customer_visitors v where v.visitor_token_hash = p_visitor_token_hash for update;
  if v_id is not null then
    if exists (select 1 from public.customer_sessions s where s.session_token_hash = p_session_token_hash and s.visitor_id <> v_id) then raise exception 'visitor and session do not match'; end if;
    if exists (select 1 from public.customer_visitors v where v.id = v_id and (v.revoked_at is not null or (v.expires_at is not null and v.expires_at <= now())))
      or exists (select 1 from public.customer_sessions s where s.visitor_id = v_id and s.session_token_hash = p_session_token_hash and (s.revoked_at is not null or (s.expires_at is not null and s.expires_at <= now()))) then
      return query select v_id, null::uuid, 'inactive'::text; return;
    end if;
  else
    insert into public.customer_visitors(visitor_token_hash) values (p_visitor_token_hash) returning id into v_id;
  end if;
  insert into public.customer_sessions(visitor_id, session_token_hash) values (v_id, p_session_token_hash)
    on conflict (session_token_hash) do update set last_seen_at = now() returning id into s_id;
  return query select v_id, s_id, 'created'::text;
end; $$;

create or replace function public.append_customer_consent(p_visitor_id uuid, p_session_id uuid, p_consent jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_version text; v_withdrawn boolean; v_reason text;
begin
  if not exists (select 1 from public.customer_visitors v join public.customer_sessions s on s.visitor_id = v.id where v.id = p_visitor_id and s.id = p_session_id and v.revoked_at is null and s.revoked_at is null and (v.expires_at is null or v.expires_at > now()) and (s.expires_at is null or s.expires_at > now())) then raise exception 'visitor and session are inactive'; end if;
  if exists (select 1 from jsonb_object_keys(p_consent) k where k not in ('version','locale','source','analytics','personalization','aiProcessing','aiConversationStorage','roomImageProcessing','roomImageStorage','marketing','withdrawn','withdrawalReason')) then raise exception 'unknown consent keys are not allowed'; end if;
  v_version := nullif(p_consent->>'version', '');
  if (p_consent ? 'withdrawn' and jsonb_typeof(p_consent->'withdrawn') <> 'boolean') or (p_consent ? 'withdrawalReason' and jsonb_typeof(p_consent->'withdrawalReason') <> 'string') then raise exception 'withdrawal fields have invalid types'; end if;
  v_reason := nullif(btrim(p_consent->>'withdrawalReason'), '');
  if (p_consent ? 'withdrawn' and (p_consent->>'withdrawn')::boolean <> (v_reason is not null)) or (p_consent ? 'withdrawalReason' and v_reason is null) then raise exception 'withdrawal requires withdrawn true and a non-empty withdrawalReason'; end if;
  v_withdrawn := v_reason is not null;
  if v_version is null then raise exception 'policy version is required'; end if;
  insert into public.customer_consent_ledger(visitor_id, session_id, policy_version, locale, source, actor, analytics, personalization, ai_processing, ai_conversation_storage, room_image_processing, room_image_storage, marketing, withdrawn_at, withdrawal_reason)
  values (p_visitor_id, p_session_id, v_version, coalesce(p_consent->>'locale','vi'), coalesce(p_consent->>'source','settings'), 'visitor', case when v_withdrawn then false else coalesce((p_consent->>'analytics')::boolean,false) end, case when v_withdrawn then false else coalesce((p_consent->>'personalization')::boolean,false) end, case when v_withdrawn then false else coalesce((p_consent->>'aiProcessing')::boolean,false) end, case when v_withdrawn then false else coalesce((p_consent->>'aiConversationStorage')::boolean,false) end, case when v_withdrawn then false else coalesce((p_consent->>'roomImageProcessing')::boolean,false) end, case when v_withdrawn then false else coalesce((p_consent->>'roomImageStorage')::boolean,false) end, case when v_withdrawn then false else coalesce((p_consent->>'marketing')::boolean,false) end, case when v_withdrawn then now() end, case when v_withdrawn then v_reason end);
  if v_withdrawn then
    update public.customer_sessions set revoked_at = now() where id = p_session_id and visitor_id = p_visitor_id;
    update public.customer_visitors set revoked_at = now() where id = p_visitor_id;
    insert into public.customer_subject_deletion_queue(visitor_id, session_id, visitor_created_at)
      select id, p_session_id, created_at from public.customer_visitors where id = p_visitor_id on conflict do nothing;
  end if;
  return (select to_jsonb(c) from public.customer_consent_current c where c.visitor_id = p_visitor_id);
end; $$;

create or replace function public.append_customer_event(p_visitor_id uuid, p_session_id uuid, p_event jsonb, p_received_at timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare v_name text := p_event->>'name'; v_key text; v_properties jsonb := coalesce(p_event->'properties', '{}'::jsonb); v_purposes text[];
begin
  if not exists (select 1 from public.customer_visitors v join public.customer_sessions s on s.visitor_id = v.id where v.id = p_visitor_id and s.id = p_session_id and v.revoked_at is null and s.revoked_at is null and (v.expires_at is null or v.expires_at > now()) and (s.expires_at is null or s.expires_at > now())) then raise exception 'visitor and session are inactive'; end if;
  if p_event ?| array['unknown','payload','raw'] or exists (select 1 from jsonb_object_keys(p_event) k where k not in ('name','idempotencyKey','properties')) then raise exception 'unknown event keys are not allowed'; end if;
  if jsonb_typeof(v_properties) <> 'object' or exists (select 1 from jsonb_object_keys(v_properties) k where k not in ('routeKey','locale','productId','variantId','placement','filterKeys','resultCountBucket','requestId','itemIds','itemId','rank','sourcePlacement','cartId','itemCountBucket','preferenceKeys','analysisId','correctionFlags')) then raise exception 'unknown event properties are not allowed'; end if;
  v_key := nullif(p_event->>'idempotencyKey', '');
  if v_key is null then raise exception 'idempotency key is required'; end if;
  if v_name is null or v_name not in ('page_viewed','product_viewed','search_submitted','recommendation_impression','recommendation_clicked','cart_item_added','checkout_started','preference_updated','room_analysis_confirmed') then raise exception 'unknown event name'; end if;
  v_purposes := case v_name when 'cart_item_added' then array['essential'] when 'checkout_started' then array['essential'] when 'recommendation_impression' then array['personalization'] when 'recommendation_clicked' then array['personalization'] when 'preference_updated' then array['personalization'] when 'room_analysis_confirmed' then array['room_image_processing','personalization'] when 'product_viewed' then array['analytics','personalization'] else array['analytics'] end;
  if not ('essential' = any(v_purposes)) and not exists (select 1 from public.customer_consent_current c where c.visitor_id = p_visitor_id and c.withdrawn_at is null and (not ('analytics' = any(v_purposes)) or c.analytics) and (not ('personalization' = any(v_purposes)) or c.personalization) and (not ('room_image_processing' = any(v_purposes)) or c.room_image_processing)) then raise exception 'required consent purpose is not granted'; end if;
  insert into public.customer_events(visitor_id, session_id, event_name, idempotency_key_hash, occurred_at, received_at, route_key, locale, product_id, variant_id, placement, filter_keys, result_count_bucket, request_id, item_ids, item_id, rank, source_placement, cart_id, item_count_bucket, preference_keys, analysis_id, correction_flags)
  values (p_visitor_id, p_session_id, v_name, encode(digest(v_key, 'sha256'), 'hex'), p_received_at, now(), v_properties->>'routeKey', v_properties->>'locale', nullif(v_properties->>'productId',''), nullif(v_properties->>'variantId',''), v_properties->>'placement', case when v_properties ? 'filterKeys' then array(select jsonb_array_elements_text(v_properties->'filterKeys')) end, v_properties->>'resultCountBucket', v_properties->>'requestId', case when v_properties ? 'itemIds' then array(select jsonb_array_elements_text(v_properties->'itemIds')) end, nullif(v_properties->>'itemId',''), nullif(v_properties->>'rank','')::integer, v_properties->>'sourcePlacement', nullif(v_properties->>'cartId',''), v_properties->>'itemCountBucket', case when v_properties ? 'preferenceKeys' then array(select jsonb_array_elements_text(v_properties->'preferenceKeys')) end, v_properties->>'analysisId', case when v_properties ? 'correctionFlags' then array(select jsonb_array_elements_text(v_properties->'correctionFlags')) end) on conflict (session_id, idempotency_key_hash) do nothing;
  return case when found then 'accepted' else 'duplicate' end;
end; $$;

create or replace function public.process_customer_subject_deletion(p_queue_id bigint, p_batch_size integer default 100)
returns integer language plpgsql security definer set search_path = public as $$
declare q record; v_deleted integer := 0;
begin
  if p_batch_size not between 1 and 1000 then raise exception 'p_batch_size must be between 1 and 1000'; end if;
  select q.id, q.visitor_id, q.session_id, q.visitor_created_at into q from public.customer_subject_deletion_queue q where q.id = p_queue_id and q.processed_at is null for update;
  if q.id is null then return 0; end if;
  if q.session_id is null or q.visitor_created_at is null or not exists (select 1 from public.customer_visitors v join public.customer_sessions s on s.visitor_id = v.id where v.id = q.visitor_id and v.created_at = q.visitor_created_at and s.id = q.session_id and v.revoked_at is not null and s.revoked_at is not null) then
    delete from public.customer_subject_deletion_queue where id = q.id;
    return 0;
  end if;
  perform set_config('customer_data.deletion', 'on', true);
  delete from public.customer_events where visitor_id = q.visitor_id; get diagnostics v_deleted = row_count;
  delete from public.customer_consent_current where visitor_id = q.visitor_id;
  delete from public.customer_identity_ledger where visitor_id = q.visitor_id;
  delete from public.customer_consent_ledger where visitor_id = q.visitor_id;
  delete from public.customer_subject_deletion_queue where id = q.id;
  delete from public.customer_visitors where id = q.visitor_id and created_at = q.visitor_created_at;
  return v_deleted;
end; $$;

revoke all on function public.resolve_customer_identity_v2(text,text), public.bootstrap_customer_identity_v2(text,text) from public, anon, authenticated;
grant execute on function public.resolve_customer_identity_v2(text,text), public.bootstrap_customer_identity_v2(text,text) to service_role;
