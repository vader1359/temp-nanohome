begin;

\ir fixtures.sql
\ir ../seed.sql

set local role postgres;

select plan(33);

select ok((select relrowsecurity from pg_class where oid = 'public.customer_event_rate_limits'::regclass), 'durable event limits have RLS enabled');
select ok(not has_table_privilege('anon', 'public.customer_event_rate_limits', 'select'), 'anon cannot inspect event limit buckets');
select ok(has_table_privilege('service_role', 'public.customer_event_rate_limits', 'insert'), 'service role can maintain durable event limits');
select ok(has_function_privilege('service_role', 'public.bind_verified_customer_identity(uuid, uuid, uuid)', 'execute'), 'service role can bind a verified auth user');
select ok(not has_function_privilege('authenticated', 'public.bind_verified_customer_identity(uuid, uuid, uuid)', 'execute'), 'browser auth cannot forge an identity binding');
select ok(has_function_privilege('service_role', 'public.clear_verified_customer_identity(uuid, uuid)', 'execute'), 'service role can clear a verified auth binding');
select ok(not has_function_privilege('anon', 'public.clear_verified_customer_identity(uuid, uuid)', 'execute'), 'anonymous clients cannot mutate the identity ledger');
select ok(position('pg_advisory_xact_lock' in pg_get_functiondef('public.append_customer_event(uuid, uuid, jsonb, timestamp with time zone)'::regprocedure)) > 0, 'event append serializes idempotency across serverless instances');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-4000-8000-000000000171', 'authenticated', 'authenticated', 'pipeline-one@example.test', '', now()),
  ('00000000-0000-4000-8000-000000000172', 'authenticated', 'authenticated', 'pipeline-two@example.test', '', now())
on conflict (id) do nothing;

insert into public.customer_visitors (id, visitor_token_hash)
values ('00000000-0000-4000-8000-000000000181', 'pipeline-visitor-hash');
insert into public.customer_sessions (id, visitor_id, session_token_hash)
values ('00000000-0000-4000-8000-000000000182', '00000000-0000-4000-8000-000000000181', 'pipeline-session-hash');

select is(
  public.bind_verified_customer_identity(
    '00000000-0000-4000-8000-000000000181',
    '00000000-0000-4000-8000-000000000182',
    '00000000-0000-4000-8000-000000000171'
  ),
  'bound',
  'verified user is bound to the active website identity'
);
select is(
  public.bind_verified_customer_identity(
    '00000000-0000-4000-8000-000000000181',
    '00000000-0000-4000-8000-000000000182',
    '00000000-0000-4000-8000-000000000171'
  ),
  'unchanged',
  'repeated auth synchronization does not grow the ledger'
);
select is(
  (select user_id from public.customer_identity_ledger where visitor_id = '00000000-0000-4000-8000-000000000181' order by recorded_at desc, id desc limit 1),
  '00000000-0000-4000-8000-000000000171'::uuid,
  'latest identity is the server-verified account'
);

insert into public.customer_preferences(
  visitor_id, feature_type, feature_key, feature_value, source, expires_at
) values (
  '00000000-0000-4000-8000-000000000181', 'style_tag', 'account_one', 'private',
  'customer_explicit', now() + interval '1 day'
);

select is(
  public.bind_verified_customer_identity(
    '00000000-0000-4000-8000-000000000181',
    '00000000-0000-4000-8000-000000000182',
    '00000000-0000-4000-8000-000000000172'
  ),
  'bound',
  'account switch records a new verified binding'
);
select is((select count(*) from public.customer_preferences where visitor_id = '00000000-0000-4000-8000-000000000181'), 0::bigint, 'account switch purges visitor-scoped personalization from the prior account');
select is(
  (select user_id from public.customer_identity_ledger where visitor_id = '00000000-0000-4000-8000-000000000181' order by recorded_at desc, id desc limit 1),
  '00000000-0000-4000-8000-000000000172'::uuid,
  'latest binding follows the current verified account'
);

select lives_ok($$ select public.append_customer_consent(
  '00000000-0000-4000-8000-000000000181',
  '00000000-0000-4000-8000-000000000182',
  '{"version":"pipeline-1","analytics":true,"personalization":false}'::jsonb
) $$, 'analytics-only consent is recorded');
select throws_ok($$ select public.append_customer_event(
  '00000000-0000-4000-8000-000000000181',
  '00000000-0000-4000-8000-000000000182',
  '{"name":"product_viewed","idempotencyKey":"pipeline-view-0001","properties":{"productId":"00000000-0000-4000-8000-000000000021","variantId":"00000000-0000-4000-8000-000000000031","placement":"pdp"}}'::jsonb,
  now()
) $$, 'P0001', 'required consent purpose is not granted', 'product views require analytics and personalization consent');

select lives_ok($$ select public.append_customer_consent(
  '00000000-0000-4000-8000-000000000181',
  '00000000-0000-4000-8000-000000000182',
  '{"version":"pipeline-2","analytics":true,"personalization":true}'::jsonb
) $$, 'analytics and personalization consent is recorded');
select throws_ok($$ select public.append_customer_event(
  '00000000-0000-4000-8000-000000000181',
  '00000000-0000-4000-8000-000000000182',
  '{"name":"product_viewed","idempotencyKey":"pipeline-view-bad1","properties":{"productId":"00000000-0000-4000-8000-000000000022","variantId":"00000000-0000-4000-8000-000000000031","placement":"pdp"}}'::jsonb,
  now()
) $$, 'P0001', 'canonical product and variant are required', 'product view rejects a mismatched canonical pair');

select is(public.append_customer_event(
  '00000000-0000-4000-8000-000000000181',
  '00000000-0000-4000-8000-000000000182',
  '{"name":"product_viewed","idempotencyKey":"pipeline-view-0001","properties":{"productId":"00000000-0000-4000-8000-000000000021","variantId":"00000000-0000-4000-8000-000000000031","placement":"pdp"}}'::jsonb,
  now()
), 'accepted', 'consented canonical product view is accepted');
select is(public.append_customer_event(
  '00000000-0000-4000-8000-000000000181',
  '00000000-0000-4000-8000-000000000182',
  '{"name":"product_viewed","idempotencyKey":"pipeline-view-0001","properties":{"productId":"00000000-0000-4000-8000-000000000021","variantId":"00000000-0000-4000-8000-000000000031","placement":"pdp"}}'::jsonb,
  now()
), 'duplicate', 'idempotent retry returns duplicate without another event');
select is((select count(*) from public.customer_events where visitor_id = '00000000-0000-4000-8000-000000000181'), 1::bigint, 'idempotency is durable in the event table');
select is((select count(*) from public.customer_recent_entities where visitor_id = '00000000-0000-4000-8000-000000000181' and deleted_at is null), 2::bigint, 'one view projects product and variant IDs only');
select is((select min(interaction_count) from public.customer_recent_entities where visitor_id = '00000000-0000-4000-8000-000000000181'), 1, 'first product view starts a bounded interaction count');

select is(public.append_customer_event(
  '00000000-0000-4000-8000-000000000181',
  '00000000-0000-4000-8000-000000000182',
  '{"name":"product_viewed","idempotencyKey":"pipeline-view-0002","properties":{"productId":"00000000-0000-4000-8000-000000000021","variantId":"00000000-0000-4000-8000-000000000031","placement":"pdp"}}'::jsonb,
  now()
), 'accepted', 'a distinct product view is accepted');
select is((select min(interaction_count) from public.customer_recent_entities where visitor_id = '00000000-0000-4000-8000-000000000181'), 2, 'repeat views update the bounded recent projection');

do $$
declare
  v_product_id uuid;
  v_variant_id uuid;
begin
  for i in 1..25 loop
    v_product_id := gen_random_uuid();
    v_variant_id := gen_random_uuid();
    insert into public.products(id, name) values (v_product_id, 'Pipeline product ' || i);
    insert into public.variants(id, product_id, name) values (v_variant_id, v_product_id, 'Pipeline variant ' || i);
    insert into public.customer_events(
      visitor_id, session_id, event_name, idempotency_key_hash,
      occurred_at, received_at, product_id, variant_id, placement
    ) values (
      '00000000-0000-4000-8000-000000000181',
      '00000000-0000-4000-8000-000000000182',
      'product_viewed', 'pipeline-direct-' || i, now(), now(),
      v_product_id, v_variant_id, 'pdp'
    );
  end loop;
end;
$$;

select is((select count(*) from public.customer_recent_entities where visitor_id = '00000000-0000-4000-8000-000000000181' and deleted_at is null), 50::bigint, 'recent entity projection is capped at fifty active IDs');
select ok((select bool_and(expires_at > now() + interval '29 days' and expires_at <= now() + interval '31 days') from public.customer_recent_entities where visitor_id = '00000000-0000-4000-8000-000000000181' and deleted_at is null), 'recent entity expiry is refreshed to thirty days');

do $$
begin
  for i in 3..60 loop
    perform public.append_customer_event(
      '00000000-0000-4000-8000-000000000181',
      '00000000-0000-4000-8000-000000000182',
      jsonb_build_object(
        'name', 'page_viewed',
        'idempotencyKey', 'pipeline-rate-' || lpad(i::text, 8, '0'),
        'properties', jsonb_build_object('routeKey', '/', 'locale', 'vi')
      ),
      now()
    );
  end loop;
end;
$$;

select is(public.append_customer_event(
  '00000000-0000-4000-8000-000000000181',
  '00000000-0000-4000-8000-000000000182',
  '{"name":"page_viewed","idempotencyKey":"pipeline-rate-00000061","properties":{"routeKey":"/","locale":"vi"}}'::jsonb,
  now()
), 'rate_limited', 'sixty-first event in a durable minute bucket is rejected');
select is((select event_count from public.customer_event_rate_limits where session_id = '00000000-0000-4000-8000-000000000182'), 60, 'durable limiter count is shared in the database');

select is(public.clear_verified_customer_identity(
  '00000000-0000-4000-8000-000000000181',
  '00000000-0000-4000-8000-000000000182'
), 'cleared', 'logout records an anonymous identity transition');
select is((select count(*) from public.customer_recent_entities where visitor_id = '00000000-0000-4000-8000-000000000181'), 0::bigint, 'logout clears visitor-scoped recent entities');
select is((select identity_kind from public.customer_identity_ledger where visitor_id = '00000000-0000-4000-8000-000000000181' order by recorded_at desc, id desc limit 1), 'anonymous', 'latest identity cannot expose the prior authenticated account');
select is(public.clear_verified_customer_identity(
  '00000000-0000-4000-8000-000000000181',
  '00000000-0000-4000-8000-000000000182'
), 'unchanged', 'repeated logout synchronization is idempotent');

select * from finish();
rollback;
