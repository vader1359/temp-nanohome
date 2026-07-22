alter table public.customer_events
  add constraint customer_events_page_viewed_columns check (
    event_name <> 'page_viewed' or (
      route_key is not null and locale is not null and product_id is null
      and variant_id is null and placement is null and filter_keys is null
      and result_count_bucket is null and request_id is null and item_ids is null
      and item_id is null and rank is null and source_placement is null
      and cart_id is null and item_count_bucket is null and preference_keys is null
      and analysis_id is null and correction_flags is null
    )
  ),
  add constraint customer_events_product_viewed_columns check (
    event_name <> 'product_viewed' or (
      product_id is not null and variant_id is not null and placement is not null
      and route_key is null and locale is null and filter_keys is null
      and result_count_bucket is null and request_id is null and item_ids is null
      and item_id is null and rank is null and source_placement is null
      and cart_id is null and item_count_bucket is null and preference_keys is null
      and analysis_id is null and correction_flags is null
    )
  ),
  add constraint customer_events_search_submitted_columns check (
    event_name <> 'search_submitted' or (
      result_count_bucket is not null and route_key is null and locale is null
      and product_id is null and variant_id is null and placement is null
      and filter_keys is null and request_id is null and item_ids is null
      and item_id is null and rank is null and source_placement is null
      and cart_id is null and item_count_bucket is null and preference_keys is null
      and analysis_id is null and correction_flags is null
    )
  ),
  add constraint customer_events_recommendation_impression_columns check (
    event_name <> 'recommendation_impression' or (
      request_id is not null and placement is not null and item_ids is not null
      and route_key is null and locale is null and product_id is null
      and variant_id is null and filter_keys is null and result_count_bucket is null
      and item_id is null and rank is null and source_placement is null
      and cart_id is null and item_count_bucket is null and preference_keys is null
      and analysis_id is null and correction_flags is null
    )
  ),
  add constraint customer_events_recommendation_clicked_columns check (
    event_name <> 'recommendation_clicked' or (
      request_id is not null and item_id is not null and rank is not null
      and route_key is null and locale is null and product_id is null
      and variant_id is null and placement is null and filter_keys is null
      and result_count_bucket is null and item_ids is null and source_placement is null
      and cart_id is null and item_count_bucket is null and preference_keys is null
      and analysis_id is null and correction_flags is null
    )
  ),
  add constraint customer_events_cart_item_added_columns check (
    event_name <> 'cart_item_added' or (
      variant_id is not null and source_placement is not null
      and route_key is null and locale is null and product_id is null
      and placement is null and filter_keys is null and result_count_bucket is null
      and request_id is null and item_ids is null and item_id is null and rank is null
      and cart_id is null and item_count_bucket is null and preference_keys is null
      and analysis_id is null and correction_flags is null
    )
  ),
  add constraint customer_events_checkout_started_columns check (
    event_name <> 'checkout_started' or (
      cart_id is not null and item_count_bucket is not null
      and route_key is null and locale is null and product_id is null
      and variant_id is null and placement is null and filter_keys is null
      and result_count_bucket is null and request_id is null and item_ids is null
      and item_id is null and rank is null and source_placement is null
      and preference_keys is null and analysis_id is null and correction_flags is null
    )
  ),
  add constraint customer_events_preference_updated_columns check (
    event_name <> 'preference_updated' or (
      preference_keys is not null and route_key is null and locale is null
      and product_id is null and variant_id is null and placement is null
      and filter_keys is null and result_count_bucket is null and request_id is null
      and item_ids is null and item_id is null and rank is null and source_placement is null
      and cart_id is null and item_count_bucket is null and analysis_id is null
      and correction_flags is null
    )
  ),
  add constraint customer_events_room_analysis_columns check (
    event_name <> 'room_analysis_confirmed' or (
      analysis_id is not null and correction_flags is not null
      and route_key is null and locale is null and product_id is null
      and variant_id is null and placement is null and filter_keys is null
      and result_count_bucket is null and request_id is null and item_ids is null
      and item_id is null and rank is null and source_placement is null
      and cart_id is null and item_count_bucket is null and preference_keys is null
    )
  );

create unique index customer_subject_deletion_queue_pending_visitor_idx
  on public.customer_subject_deletion_queue(visitor_id) where processed_at is null;

create or replace function public.bootstrap_customer_identity(p_visitor_token_hash text, p_session_token_hash text)
returns table(visitor_id uuid, session_id uuid) language plpgsql security definer set search_path = public as $$
declare v_id uuid; s_id uuid; v_existing uuid;
begin
  if nullif(p_visitor_token_hash, '') is null or nullif(p_session_token_hash, '') is null then
    raise exception 'identity token hashes are required';
  end if;
  select visitor_id into v_existing from public.customer_sessions where session_token_hash = p_session_token_hash;
  if v_existing is not null then
    if not exists (select 1 from public.customer_visitors where id = v_existing and visitor_token_hash = p_visitor_token_hash) then
      raise exception 'visitor and session do not match';
    end if;
  end if;
  insert into public.customer_visitors(visitor_token_hash) values (p_visitor_token_hash)
    on conflict (visitor_token_hash) do update set last_seen_at = now() returning id into v_id;
  insert into public.customer_sessions(visitor_id, session_token_hash) values (v_id, p_session_token_hash)
    on conflict (session_token_hash) do update set last_seen_at = now() returning id into s_id;
  return query select v_id, s_id;
end; $$;

create or replace function public.append_customer_consent(p_visitor_id uuid, p_session_id uuid, p_consent jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_version text; v_locale text; v_source text; v_withdrawn boolean; v_reason text;
begin
  if not exists (select 1 from public.customer_sessions where id = p_session_id and visitor_id = p_visitor_id) then raise exception 'visitor and session do not match'; end if;
  if exists (select 1 from jsonb_object_keys(p_consent) k where k not in ('version','locale','source','analytics','personalization','aiProcessing','aiConversationStorage','roomImageProcessing','roomImageStorage','marketing','withdrawn','withdrawalReason')) then raise exception 'unknown consent keys are not allowed'; end if;
  v_version := p_consent->>'version'; v_locale := coalesce(p_consent->>'locale', 'vi'); v_source := coalesce(p_consent->>'source', 'settings');
  if (p_consent ? 'withdrawn' and jsonb_typeof(p_consent->'withdrawn') <> 'boolean') or (p_consent ? 'withdrawalReason' and jsonb_typeof(p_consent->'withdrawalReason') <> 'string') then raise exception 'withdrawal fields have invalid types'; end if;
  v_reason := nullif(btrim(p_consent->>'withdrawalReason'), '');
  if (p_consent ? 'withdrawn' and (p_consent->>'withdrawn')::boolean <> (v_reason is not null)) or (p_consent ? 'withdrawalReason' and v_reason is null) then raise exception 'withdrawal requires withdrawn true and a non-empty withdrawalReason'; end if;
  v_withdrawn := v_reason is not null;
  if nullif(v_version, '') is null then raise exception 'policy version is required'; end if;
  insert into public.customer_consent_ledger(visitor_id, session_id, policy_version, locale, source, actor, analytics, personalization, ai_processing, ai_conversation_storage, room_image_processing, room_image_storage, marketing, withdrawn_at, withdrawal_reason)
  values (p_visitor_id, p_session_id, v_version, v_locale, v_source, 'visitor', case when v_withdrawn then false else coalesce((p_consent->>'analytics')::boolean, false) end, case when v_withdrawn then false else coalesce((p_consent->>'personalization')::boolean, false) end, case when v_withdrawn then false else coalesce((p_consent->>'aiProcessing')::boolean, false) end, case when v_withdrawn then false else coalesce((p_consent->>'aiConversationStorage')::boolean, false) end, case when v_withdrawn then false else coalesce((p_consent->>'roomImageProcessing')::boolean, false) end, case when v_withdrawn then false else coalesce((p_consent->>'roomImageStorage')::boolean, false) end, case when v_withdrawn then false else coalesce((p_consent->>'marketing')::boolean, false) end, case when v_withdrawn then now() end, case when v_withdrawn then v_reason end);
  if v_withdrawn then
    insert into public.customer_subject_deletion_queue(visitor_id)
    select p_visitor_id
    where not exists (
      select 1 from public.customer_subject_deletion_queue
      where visitor_id = p_visitor_id and processed_at is null
    );
  end if;
  return (select to_jsonb(c) from public.customer_consent_current c where c.visitor_id = p_visitor_id);
end; $$;

create or replace function public.append_customer_event(p_visitor_id uuid, p_session_id uuid, p_event jsonb, p_received_at timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare v_name text := p_event->>'name'; v_key text; v_properties jsonb := coalesce(p_event->'properties', '{}'::jsonb); v_purposes text[];
begin
  if not exists (select 1 from public.customer_sessions where id = p_session_id and visitor_id = p_visitor_id) then raise exception 'visitor and session do not match'; end if;
  if p_event ?| array['unknown','payload','raw'] or exists (select 1 from jsonb_object_keys(p_event) k where k not in ('name','idempotencyKey','properties')) then raise exception 'unknown event keys are not allowed'; end if;
  if jsonb_typeof(v_properties) <> 'object' or exists (select 1 from jsonb_object_keys(v_properties) k where k not in ('routeKey','locale','productId','variantId','placement','filterKeys','resultCountBucket','requestId','itemIds','itemId','rank','sourcePlacement','cartId','itemCountBucket','preferenceKeys','analysisId','correctionFlags')) then raise exception 'unknown event properties are not allowed'; end if;
  v_key := nullif(p_event->>'idempotencyKey', '');
  if v_key is null then raise exception 'idempotency key is required'; end if;
  if v_name is null or v_name not in ('page_viewed','product_viewed','search_submitted','recommendation_impression','recommendation_clicked','cart_item_added','checkout_started','preference_updated','room_analysis_confirmed') then raise exception 'unknown event name'; end if;
  v_purposes := case v_name when 'cart_item_added' then array['essential'] when 'checkout_started' then array['essential'] when 'recommendation_impression' then array['personalization'] when 'recommendation_clicked' then array['personalization'] when 'preference_updated' then array['personalization'] when 'room_analysis_confirmed' then array['room_image_processing','personalization'] when 'product_viewed' then array['analytics','personalization'] else array['analytics'] end;
  if not ('essential' = any(v_purposes)) and not exists (select 1 from public.customer_consent_current c where c.visitor_id = p_visitor_id and c.withdrawn_at is null and (not ('analytics' = any(v_purposes)) or c.analytics) and (not ('personalization' = any(v_purposes)) or c.personalization) and (not ('room_image_processing' = any(v_purposes)) or c.room_image_processing)) then raise exception 'required consent purpose is not granted'; end if;
  insert into public.customer_events(visitor_id, session_id, event_name, idempotency_key_hash, occurred_at, received_at, route_key, locale, product_id, variant_id, placement, filter_keys, result_count_bucket, request_id, item_ids, item_id, rank, source_placement, cart_id, item_count_bucket, preference_keys, analysis_id, correction_flags)
  values (p_visitor_id, p_session_id, v_name, encode(extensions.digest(v_key, 'sha256'), 'hex'), p_received_at, now(), v_properties->>'routeKey', v_properties->>'locale', nullif(v_properties->>'productId',''), nullif(v_properties->>'variantId',''), v_properties->>'placement', case when v_properties ? 'filterKeys' then array(select jsonb_array_elements_text(v_properties->'filterKeys')) end, v_properties->>'resultCountBucket', v_properties->>'requestId', case when v_properties ? 'itemIds' then array(select jsonb_array_elements_text(v_properties->'itemIds')) end, nullif(v_properties->>'itemId',''), nullif(v_properties->>'rank','')::integer, v_properties->>'sourcePlacement', nullif(v_properties->>'cartId',''), v_properties->>'itemCountBucket', case when v_properties ? 'preferenceKeys' then array(select jsonb_array_elements_text(v_properties->'preferenceKeys')) end, v_properties->>'analysisId', case when v_properties ? 'correctionFlags' then array(select jsonb_array_elements_text(v_properties->'correctionFlags')) end)
  on conflict (session_id, idempotency_key_hash) do nothing;
  return case when found then 'accepted' else 'duplicate' end;
end; $$;

revoke all on function public.bootstrap_customer_identity(text, text), public.append_customer_consent(uuid, uuid, jsonb), public.append_customer_event(uuid, uuid, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.bootstrap_customer_identity(text, text), public.append_customer_consent(uuid, uuid, jsonb), public.append_customer_event(uuid, uuid, jsonb, timestamptz) to service_role;
