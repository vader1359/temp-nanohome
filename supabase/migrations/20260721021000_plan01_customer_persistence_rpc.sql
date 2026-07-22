create or replace function public.refresh_customer_consent_current()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.customer_consent_current (
    visitor_id, consent_ledger_id, policy_version, locale, source, actor,
    analytics, personalization, ai_processing, ai_conversation_storage,
    room_image_processing, room_image_storage, marketing, withdrawn_at,
    withdrawal_reason, recorded_at
  ) values (
    new.visitor_id, new.id, new.policy_version, new.locale, new.source, new.actor,
    new.analytics, new.personalization, new.ai_processing,
    new.ai_conversation_storage, new.room_image_processing, new.room_image_storage,
    new.marketing, new.withdrawn_at, new.withdrawal_reason, new.recorded_at
  ) on conflict (visitor_id) do update set
    consent_ledger_id = excluded.consent_ledger_id,
    policy_version = excluded.policy_version, locale = excluded.locale,
    source = excluded.source, actor = excluded.actor, analytics = excluded.analytics,
    personalization = excluded.personalization, ai_processing = excluded.ai_processing,
    ai_conversation_storage = excluded.ai_conversation_storage,
    room_image_processing = excluded.room_image_processing,
    room_image_storage = excluded.room_image_storage, marketing = excluded.marketing,
    withdrawn_at = excluded.withdrawn_at, withdrawal_reason = excluded.withdrawal_reason,
    recorded_at = excluded.recorded_at
  where (excluded.recorded_at, excluded.consent_ledger_id) >
    (public.customer_consent_current.recorded_at,
      public.customer_consent_current.consent_ledger_id);
  return new;
end; $$;

create or replace function public.resolve_customer_identity(p_visitor_token_hash text, p_session_token_hash text)
returns table(visitor_id uuid, session_id uuid) language sql security definer set search_path = public as $$
  select v.id, s.id from public.customer_visitors v
  join public.customer_sessions s on s.visitor_id = v.id
  where v.visitor_token_hash = p_visitor_token_hash and s.session_token_hash = p_session_token_hash
    and v.revoked_at is null and s.revoked_at is null
    and (v.expires_at is null or v.expires_at > now()) and (s.expires_at is null or s.expires_at > now());
$$;

create or replace function public.bootstrap_customer_identity(p_visitor_token_hash text, p_session_token_hash text)
returns table(visitor_id uuid, session_id uuid) language plpgsql security definer set search_path = public as $$
declare v_id uuid; s_id uuid;
begin
  insert into public.customer_visitors(visitor_token_hash) values (p_visitor_token_hash)
  on conflict (visitor_token_hash) do update set last_seen_at = now() returning id into v_id;
  insert into public.customer_sessions(visitor_id, session_token_hash) values (v_id, p_session_token_hash)
  on conflict (session_token_hash) do update set last_seen_at = now() returning id into s_id;
  return query select v_id, s_id;
end; $$;

create or replace function public.current_customer_consent(p_visitor_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select to_jsonb(c) from public.customer_consent_current c where c.visitor_id = p_visitor_id;
$$;

create or replace function public.append_customer_consent(p_visitor_id uuid, p_session_id uuid, p_consent jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_version text; v_locale text; v_source text;
begin
  v_version := p_consent->>'version'; v_locale := coalesce(p_consent->>'locale', 'vi'); v_source := coalesce(p_consent->>'source', 'settings');
  if nullif(v_version, '') is null then raise exception 'policy version is required'; end if;
  insert into public.customer_consent_ledger(visitor_id, session_id, policy_version, locale, source, actor, analytics, personalization, ai_processing, ai_conversation_storage, room_image_processing, room_image_storage, marketing)
  values (p_visitor_id, p_session_id, v_version, v_locale, v_source, 'visitor', coalesce((p_consent->>'analytics')::boolean, false), coalesce((p_consent->>'personalization')::boolean, false), coalesce((p_consent->>'aiProcessing')::boolean, false), coalesce((p_consent->>'aiConversationStorage')::boolean, false), coalesce((p_consent->>'roomImageProcessing')::boolean, false), coalesce((p_consent->>'roomImageStorage')::boolean, false), coalesce((p_consent->>'marketing')::boolean, false));
  return (select to_jsonb(c) from public.customer_consent_current c where c.visitor_id = p_visitor_id);
end; $$;

create or replace function public.append_customer_event(p_visitor_id uuid, p_session_id uuid, p_event jsonb, p_received_at timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare v_name text := p_event->>'name'; v_key text := encode(extensions.digest(coalesce(p_event->>'idempotencyKey', gen_random_uuid()::text), 'sha256'), 'hex'); v_properties jsonb := p_event->'properties';
begin
  insert into public.customer_events(visitor_id, session_id, event_name, idempotency_key_hash, occurred_at, received_at, route_key, locale, product_id, variant_id, placement, filter_keys, result_count_bucket, request_id, item_ids, item_id, rank, source_placement, cart_id, item_count_bucket, preference_keys, analysis_id, correction_flags)
  values (p_visitor_id, p_session_id, v_name, v_key, p_received_at, now(), v_properties->>'routeKey', v_properties->>'locale', nullif(v_properties->>'productId',''), nullif(v_properties->>'variantId',''), coalesce(v_properties->>'placement', v_properties->>'sourcePlacement'), array(select jsonb_array_elements_text(v_properties->'filterKeys')), v_properties->>'resultCountBucket', v_properties->>'requestId', array(select jsonb_array_elements_text(v_properties->'itemIds')), nullif(v_properties->>'itemId',''), nullif(v_properties->>'rank','')::integer, v_properties->>'sourcePlacement', nullif(v_properties->>'cartId',''), v_properties->>'itemCountBucket', array(select jsonb_array_elements_text(v_properties->'preferenceKeys')), v_properties->>'analysisId', array(select jsonb_array_elements_text(v_properties->'correctionFlags')))
  on conflict (session_id, idempotency_key_hash) do nothing;
  return case when found then 'accepted' else 'duplicate' end;
end; $$;

alter table public.customer_events
  alter column product_id type text using product_id::text,
  alter column variant_id type text using variant_id::text,
  alter column item_ids type text[] using item_ids::text[],
  alter column item_id type text using item_id::text,
  alter column cart_id type text using cart_id::text;

revoke all on function public.resolve_customer_identity(text, text) from public, anon, authenticated;
revoke all on function public.bootstrap_customer_identity(text, text) from public, anon, authenticated;
revoke all on function public.current_customer_consent(uuid) from public, anon, authenticated;
revoke all on function public.append_customer_consent(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.append_customer_event(uuid, uuid, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.resolve_customer_identity(text, text) to service_role;
grant execute on function public.bootstrap_customer_identity(text, text) to service_role;
grant execute on function public.current_customer_consent(uuid) to service_role;
grant execute on function public.append_customer_consent(uuid, uuid, jsonb) to service_role;
grant execute on function public.append_customer_event(uuid, uuid, jsonb, timestamptz) to service_role;
