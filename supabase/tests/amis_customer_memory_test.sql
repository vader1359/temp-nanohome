begin;

set local role postgres;
select plan(15);

select ok((select relrowsecurity from pg_class where oid = 'public.customer_amis_links'::regclass), 'links have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.amis_customer_snapshots'::regclass), 'customer snapshots have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.amis_sale_order_summaries'::regclass), 'order summaries have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.customer_memory_projections'::regclass), 'projections have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.amis_sync_cursors'::regclass), 'cursors have RLS');
select ok(not has_table_privilege('anon', 'public.amis_customer_snapshots', 'select'), 'anon cannot read source snapshots');
select ok(not has_table_privilege('authenticated', 'public.amis_customer_snapshots', 'select'), 'authenticated cannot read source snapshots');
select ok(not has_table_privilege('authenticated', 'public.customer_amis_links', 'select'), 'authenticated cannot read links');
select ok(has_table_privilege('authenticated', 'public.customer_memory_projections', 'select'), 'authenticated can query projection relation');
select ok(not has_table_privilege('anon', 'public.customer_memory_projections', 'select'), 'anon cannot query projections');
select ok(not has_column('public.amis_customer_snapshots', 'email'), 'source snapshot has no email column');

select lives_ok($$ select jsonb_build_object('linkId', 'link-1', 'preferredRoomIds', jsonb_build_array('room-1'), 'preferredBrandIds', jsonb_build_array(), 'discussedVariantIds', jsonb_build_array(), 'purchasedVariantIds', jsonb_build_array(), 'sourceUpdatedAt', '2026-01-01T00:00:00Z') $$, 'safe DTO keys are representable');
select throws_ok($$ insert into public.customer_amis_links (user_id, amis_customer_id, state, method, evidence_category) values (gen_random_uuid(), 'customer-1', 'active', 'fuzzy_email', 'secret') $$, '23514', null, 'fuzzy link methods are rejected');
select ok(not has_table_privilege('service_role', 'public.amis_customer_snapshots', 'select'), 'service role grants remain explicit');
select ok(not has_table_privilege('anon', 'public.amis_sync_cursors', 'select'), 'anon cannot read cursors');
select ok(not has_table_privilege('authenticated', 'public.amis_sale_order_summaries', 'select'), 'authenticated cannot read order summaries');

select * from finish();
rollback;
