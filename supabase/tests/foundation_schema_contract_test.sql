begin;
\ir fixtures.sql
set local role postgres;

create temporary table foundation_schema_contract_manifest (
  lane text not null,
  contract_name text primary key,
  object_kind text not null check (object_kind in ('table', 'view', 'port')),
  implementation_state text not null check (implementation_state in ('implemented', 'external', 'disabled', 'deferred-by-user')),
  relation_name text,
  required_columns text[] not null default '{}',
  required_constraints text[] not null default '{}',
  rls_required boolean,
  browser_access text check (browser_access in ('none', 'safe-view', 'owner-read')),
  safe_projection text,
  owner_boundary text,
  runtime_assumption text not null
) on commit drop;

insert into foundation_schema_contract_manifest (
  lane, contract_name, object_kind, implementation_state, relation_name,
  required_columns, required_constraints, rls_required, browser_access,
  safe_projection, owner_boundary, runtime_assumption
)
values
  ('Account', 'identity-providers', 'table', 'implemented', 'customer_identity_providers', array['provider','issuer','audience'], array['customer_identity_providers_pkey'], true, 'none', null, 'service-role writes only', 'provider registry only; no provider runtime enabled'),
  ('Account', 'customer-accounts', 'table', 'implemented', 'customer_accounts', array['id','legacy_supabase_user_id','state','created_at','updated_at'], array['customer_accounts_pkey'], true, 'none', null, 'server-resolved account id', 'Firebase and Supabase cutover disabled'),
  ('Account', 'firebase-principals', 'table', 'implemented', 'customer_firebase_principals', array['account_id','firebase_uid','status'], array['customer_firebase_principals_account_id_fkey'], true, 'none', null, 'account FK uses RESTRICT', 'Firebase verification adapter disabled'),
  ('Account', 'auth-identities', 'table', 'implemented', 'customer_auth_identities', array['account_id','provider','subject','status'], array['customer_auth_identities_account_id_fkey'], true, 'none', null, 'account FK uses RESTRICT', 'external identity mapping only'),
  ('Account', 'policy-acceptances', 'table', 'implemented', 'account_policy_acceptances', array['account_id','policy_kind','policy_version','accepted_at'], array['account_policy_acceptances_account_id_fkey'], true, 'none', null, 'account FK uses RESTRICT', 'server append only'),
  ('Account', 'deletion-requests', 'table', 'implemented', 'customer_account_deletion_requests', array['account_id','requested_at','status'], array['customer_account_deletion_requests_account_id_fkey'], true, 'none', null, 'account FK uses RESTRICT', 'deletion worker disabled'),
  ('Account', 'account-session-verifier', 'port', 'disabled', null, '{}', '{}', null, null, null, 'server-only provider composition', 'Todo 15 sibling consumer; no runtime verifier enabled'),

  ('Checkout', 'orders', 'table', 'implemented', 'orders', array['account_id','owner_scope','guest_owner_id','guest_owner_token_digest','order_kind','web_order_number','idempotency_key','price_snapshot','payment_status','refund_status'], array['orders_owner_scope_check','orders_authenticated_owner_shape_check','orders_guest_owner_shape_check'], true, 'none', null, 'account or digest-bound guest scope', 'checkout orchestration and SePay activation external'),
  ('Checkout', 'order-status-history', 'table', 'implemented', 'order_status_history', array['order_id','actor_kind','actor_account_id','actor_staff_id'], array['order_status_history_actor_kind_check','order_status_history_actor_shape_check'], true, 'none', null, 'account, staff, or system actor', 'status writer remains server-only'),
  ('Checkout', 'payment-attempts', 'table', 'implemented', 'payment_attempts', array['order_id','checkout_id','provider','merchant_reference','idempotency_key','amount','currency','state','request_digest','response_digest'], array['payment_attempts_order_link_check','payment_attempts_provider_check','payment_attempts_amount_check'], true, 'none', null, 'service-role ledger', 'provider-neutral; SePay and ZaloPay adapters disabled'),
  ('Checkout', 'payment-events', 'table', 'implemented', 'payment_events', array['attempt_id','provider','event_type','verification_decision','transition_decision','payload_digest'], array['payment_events_provider_check','payment_events_applied_requires_verification'], true, 'none', null, 'append-only service ledger', 'IPN runtime disabled'),
  ('Checkout', 'payment-reconciliations', 'table', 'implemented', 'payment_reconciliations', array['attempt_id','provider_status','response_digest','decision'], array['payment_reconciliations_decision_check'], true, 'none', null, 'service-role ledger', 'reconciliation worker disabled'),
  ('Checkout', 'refund-operations', 'table', 'implemented', 'refund_operations', array['order_id','checkout_id','payment_attempt_id','method','state','amount','currency','idempotency_key','requested_by','approved_by','bank_evidence_digest'], array['refund_operations_order_link_check','refund_operations_manual_dual_actor_check','refund_operations_manual_evidence_check'], true, 'none', null, 'dual-actor manual boundary', 'refund execution disabled'),
  ('Checkout', 'refund-events', 'table', 'implemented', 'refund_events', array['refund_operation_id','event_type','transition_decision','actor','payload_digest'], array['refund_events_refund_operation_id_fkey'], true, 'none', null, 'append-only service ledger', 'refund execution disabled'),
  ('Checkout', 'checkout-provider-adapter', 'port', 'external', null, '{}', '{}', null, null, null, 'Checkout sibling owns orchestration', 'no provider credentials or network calls'),
  ('Checkout', 'offer-eligibility', 'port', 'deferred-by-user', null, '{}', '{}', null, null, null, 'not implemented by explicit user decision', 'offers are deferred, not missing'),
  ('Checkout', 'inventory-reservations', 'port', 'deferred-by-user', null, '{}', '{}', null, null, null, 'not implemented by explicit user decision', 'reservations are deferred, not missing'),

  ('Chat', 'advisor-handoffs', 'table', 'implemented', 'customer_advisor_handoffs', array['public_reference','conversation_id','owner_scope','owner_account_id','guest_owner_scope_id','status','restricted_contact_reference'], array['customer_advisor_handoffs_owner_scope_check'], true, 'safe-view', 'customer_advisor_handoff_safe_status', 'account or guest owner scope', 'advisor assignment runtime external'),
  ('Chat', 'advisor-handoff-summaries', 'table', 'implemented', 'customer_advisor_handoff_summaries', array['handoff_id','summary_version','safe_summary','structured_intent'], array['customer_advisor_handoff_summaries_handoff_version_unique'], true, 'none', null, 'service-role writes only', 'summary generation external'),
  ('Chat', 'advisor-handoff-events', 'table', 'implemented', 'customer_advisor_handoff_events', array['handoff_id','event_type','from_status','to_status','actor_reference','safe_reason'], array['customer_advisor_handoff_events_type_check'], true, 'none', null, 'append-only service ledger', 'advisor workflow external'),
  ('Chat', 'advisor-notification-outbox', 'table', 'implemented', 'customer_advisor_notification_outbox', array['handoff_id','destination_adapter','delivery_status','attempt_count','response_digest'], array['customer_advisor_notification_outbox_status_check'], true, 'none', null, 'service-role outbox', 'notification delivery disabled'),
  ('Chat', 'attachment-intents', 'table', 'implemented', 'chat_attachment_intents', array['conversation_id','owner_scope','owner_account_id','guest_owner_scope_id','expected_mime_type','expires_at','state'], array['chat_attachment_intents_owner_scope_check'], true, 'none', null, 'account or guest owner scope', 'upload route and vision worker external'),
  ('Chat', 'attachments', 'table', 'implemented', 'chat_attachments', array['intent_id','conversation_id','owner_scope','owner_account_id','guest_owner_scope_id','object_path','sha256_digest','state','retention_expires_at'], array['chat_attachments_owner_scope_check'], true, 'none', null, 'account or guest owner scope', 'object storage and vision worker disabled'),
  ('Chat', 'chat-advisor-runtime', 'port', 'external', null, '{}', '{}', null, null, null, 'Chat sibling owns UI and transcript writer', 'no chat, upload, vision, or notification runtime enabled'),

  ('Personalization', 'amis-contact-snapshots', 'table', 'implemented', 'amis_contact_snapshots', array['amis_contact_id','amis_contact_code','amis_customer_id','payload_digest','mapper_version','fetched_at'], array['amis_contact_snapshots_pkey'], true, 'none', null, 'restricted service projection', 'AMIS reads external; AMIS writes prohibited'),
  ('Personalization', 'customer-memory-projections', 'table', 'implemented', 'customer_memory_projections', array['account_id','link_id','purchased_variant_ids','discussed_variant_ids','preferred_room_ids','preferred_brand_ids','customer_visible_summary','source_watermark'], array['customer_memory_projections_account_id_fkey'], true, 'safe-view', 'customer_memory_projections_safe', 'current account only', 'projection worker external'),
  ('Personalization', 'customer-memory-briefs', 'table', 'implemented', 'customer_memory_briefs', array['link_id','account_id','preferred_room_ids','preferred_brand_ids','customer_visible_summary','brief_version','expires_at'], array['customer_memory_briefs_account_id_fkey'], true, 'safe-view', 'customer_memory_briefs_safe', 'current account only; account FK RESTRICT', 'brief generator external'),
  ('Personalization', 'recommendation-signals', 'table', 'implemented', 'customer_recommendation_signals', array['account_id','link_id','variant_id','signal_kind','signal_source','signal_count','shadow_only','expires_at'], array['customer_recommendation_signals_account_id_fkey'], true, 'safe-view', 'customer_recommendation_signals_safe', 'current account only; account FK RESTRICT', 'signal worker external and shadow-only'),
  ('Personalization', 'variant-recommendation-features', 'table', 'implemented', 'variant_recommendation_features', array['variant_id','product_id','brand_id','price_band','eligible','has_primary_image','in_stock','feature_version'], array['variant_recommendation_features_pkey'], true, 'none', null, 'restricted service projection', 'feature worker external'),
  ('Personalization', 'personalization-settings', 'table', 'implemented', 'customer_personalization_settings', array['account_id','enabled','use_amis_history','use_behavior_history','recommendation_shadow_mode','policy_version'], array['customer_personalization_settings_account_id_fkey'], true, 'safe-view', 'customer_personalization_settings_safe', 'current account only; account FK RESTRICT', 'recommendations remain shadow mode'),
  ('Personalization', 'amis-recommender-runtime', 'port', 'external', null, '{}', '{}', null, null, null, 'Personalization sibling owns AMIS read clients and recommender', 'AMIS writes and live scoring disabled');

select plan(11);

select is(
  (select count(*) from foundation_schema_contract_manifest where implementation_state = 'implemented'),
  25::bigint,
  'manifest enumerates every implemented Wave 1 shared table boundary'
);

select is(
  (select count(*) from foundation_schema_contract_manifest where implementation_state = 'deferred-by-user'),
  2::bigint,
  'offers and reservations are explicitly deferred-by-user'
);

select lives_ok($proof$
  do $body$
  declare target record;
  begin
    for target in
      select relation_name
      from foundation_schema_contract_manifest
      where implementation_state = 'implemented' and object_kind = 'table'
    loop
      if to_regclass(format('public.%I', target.relation_name)) is null then
        raise exception 'required manifest table omitted: %', target.relation_name;
      end if;
    end loop;
  end
  $body$;
$proof$, 'every implemented manifest table exists');

select lives_ok($proof$
  do $body$
  declare target record;
  declare missing_column text;
  begin
    for target in
      select relation_name, required_columns
      from foundation_schema_contract_manifest
      where implementation_state = 'implemented' and object_kind = 'table'
    loop
      select required_column into missing_column
      from unnest(target.required_columns) required_column
      where not exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = target.relation_name
          and column_name = required_column
      )
      limit 1;
      if missing_column is not null then
        raise exception 'required manifest column omitted: %.%', target.relation_name, missing_column;
      end if;
    end loop;
  end
  $body$;
$proof$, 'every implemented manifest column exists');

select lives_ok($proof$
  do $body$
  declare target record;
  declare missing_constraint text;
  begin
    for target in
      select relation_name, required_constraints
      from foundation_schema_contract_manifest
      where implementation_state = 'implemented' and object_kind = 'table'
    loop
      select required_constraint into missing_constraint
      from unnest(target.required_constraints) required_constraint
      where not exists (
        select 1
        from pg_constraint
        where conrelid = format('public.%I', target.relation_name)::regclass
          and conname = required_constraint
      )
      limit 1;
      if missing_constraint is not null then
        raise exception 'required manifest constraint omitted: %.%', target.relation_name, missing_constraint;
      end if;
    end loop;
  end
  $body$;
$proof$, 'every implemented manifest constraint exists');

select lives_ok($proof$
  do $body$
  declare target record;
  begin
    for target in
      select relation_name
      from foundation_schema_contract_manifest
      where implementation_state = 'implemented' and rls_required
    loop
      if not (select relrowsecurity from pg_class where oid = format('public.%I', target.relation_name)::regclass) then
        raise exception 'required RLS boundary omitted: %', target.relation_name;
      end if;
    end loop;
  end
  $body$;
$proof$, 'RLS is enabled on every implemented manifest table');

select lives_ok($proof$
  do $body$
  declare target record;
  begin
    for target in
      select relation_name
      from foundation_schema_contract_manifest
      where implementation_state = 'implemented'
        and browser_access = 'none'
        and lane in ('Checkout', 'Chat', 'Personalization')
    loop
      if has_table_privilege('anon', format('public.%I', target.relation_name), 'select')
         or has_table_privilege('authenticated', format('public.%I', target.relation_name), 'select') then
        raise exception 'browser grant crosses restricted boundary: %', target.relation_name;
      end if;
    end loop;
  end
  $body$;
$proof$, 'restricted tables expose no browser SELECT grants');

select lives_ok($proof$
  do $body$
  declare target record;
  begin
    for target in
      select relation_name
      from foundation_schema_contract_manifest
      where implementation_state = 'implemented'
        and object_kind = 'table'
        and lane in ('Checkout', 'Chat', 'Personalization')
        and relation_name <> 'customer_memory_projections'
    loop
      if not has_table_privilege('service_role', format('public.%I', target.relation_name), 'select') then
        raise exception 'service-role contract grant omitted: %', target.relation_name;
      end if;
    end loop;
  end
  $body$;
$proof$, 'service_role can consume every explicitly granted Wave 3 shared table');

select lives_ok($proof$
  do $body$
  declare target record;
  begin
    for target in
      select safe_projection
      from foundation_schema_contract_manifest
      where implementation_state = 'implemented' and safe_projection is not null
    loop
      if to_regclass(format('public.%I', target.safe_projection)) is null then
        raise exception 'safe owner projection omitted: %', target.safe_projection;
      end if;
      if not coalesce((
        select (c.reloptions @> array['security_barrier=true'])
        from pg_class c
        where c.oid = format('public.%I', target.safe_projection)::regclass
      ), false) then
        raise exception 'safe owner projection lacks security barrier: %', target.safe_projection;
      end if;
    end loop;
  end
  $body$;
$proof$, 'safe owner projections exist with security barriers');

select is(
  (
    select count(*)
    from pg_constraint
    where confrelid = 'public.customer_accounts'::regclass
      and contype = 'f'
  ),
  23::bigint,
  'shared contract incorporates all 23 customer_accounts foreign keys'
);

select is(
  (
    select count(*)
    from pg_constraint
    where confrelid = 'public.customer_accounts'::regclass
      and contype = 'f'
      and confdeltype = 'r'
  ),
  21::bigint,
  'shared contract incorporates all 21 RESTRICT account ownership actions'
);

select * from finish();
rollback;
