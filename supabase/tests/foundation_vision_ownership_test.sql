begin;

\ir fixtures.sql

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  (:'authenticated_user_id', 'authenticated', 'authenticated', 'vision-owner@example.test', '', now()),
  (:'other_user_id', 'authenticated', 'authenticated', 'vision-other@example.test', '', now());

insert into public.customer_identity_providers (provider, issuer, audience)
values
  ('firebase', 'https://securetoken.google.com/foundation-vision', 'foundation-vision'),
  ('supabase', 'https://foundation-vision.supabase.co/auth/v1', 'authenticated');

insert into public.customer_firebase_principals (account_id, firebase_uid, status)
select id, 'foundation-vision-firebase-owner', 'active'
from public.customer_accounts
where legacy_supabase_user_id = :'authenticated_user_id'::uuid;

insert into public.customer_firebase_principals (account_id, firebase_uid, status)
select id, 'foundation-vision-firebase-other', 'active'
from public.customer_accounts
where legacy_supabase_user_id = :'other_user_id'::uuid;

insert into public.vision_analysis_requests (
  id, owner_id, consent_policy_version, original_object_path, normalized_object_path,
  object_hash, state, schema_version, idempotency_key
) values
  (
    '00000000-0000-4000-8000-000000000811',
    :'authenticated_user_id'::uuid,
    'v1',
    :'authenticated_user_id' || '/00000000-0000-4000-8000-000000000811/original.jpg',
    :'authenticated_user_id' || '/00000000-0000-4000-8000-000000000811/normalized.jpg',
    'hash-owner',
    'completed',
    'v1',
    'vision-owner-key'
  ),
  (
    '00000000-0000-4000-8000-000000000812',
    :'other_user_id'::uuid,
    'v1',
    :'other_user_id' || '/00000000-0000-4000-8000-000000000812/original.jpg',
    :'other_user_id' || '/00000000-0000-4000-8000-000000000812/normalized.jpg',
    'hash-other',
    'completed',
    'v1',
    'vision-other-key'
  );

insert into public.room_scenes (
  id, request_id, owner_id, scene, mapper_version, provider_version, confidence
) values
  ('00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000811', :'authenticated_user_id'::uuid, '{"objects": []}'::jsonb, 'm1', 'p1', 0.9000),
  ('00000000-0000-4000-8000-000000000822', '00000000-0000-4000-8000-000000000812', :'other_user_id'::uuid, '{"objects": []}'::jsonb, 'm1', 'p1', 0.9000);

insert into public.vision_object_crops (
  id, request_id, owner_id, object_category, bounding_box, object_path, object_hash
) values
  (
    '00000000-0000-4000-8000-000000000831',
    '00000000-0000-4000-8000-000000000811',
    :'authenticated_user_id'::uuid,
    'sofa',
    '{"x": 0, "y": 0, "w": 1, "h": 1}'::jsonb,
    :'authenticated_user_id' || '/00000000-0000-4000-8000-000000000811/crop-1.jpg',
    'crop-hash-owner'
  ),
  (
    '00000000-0000-4000-8000-000000000832',
    '00000000-0000-4000-8000-000000000812',
    :'other_user_id'::uuid,
    'lamp',
    '{"x": 0, "y": 0, "w": 1, "h": 1}'::jsonb,
    :'other_user_id' || '/00000000-0000-4000-8000-000000000812/crop-1.jpg',
    'crop-hash-other'
  );

insert into storage.objects (id, bucket_id, name)
select
  '00000000-0000-4000-8000-000000000841',
  'room-photos',
  account.id::text || '/00000000-0000-4000-8000-000000000811/original.jpg'
from public.customer_accounts account
where account.legacy_supabase_user_id = :'authenticated_user_id'::uuid;

insert into storage.objects (id, bucket_id, name)
values (
  '00000000-0000-4000-8000-000000000842',
  'room-photos',
  :'authenticated_user_id' || '/00000000-0000-4000-8000-000000000811/legacy-original.jpg'
);

insert into storage.objects (id, bucket_id, name)
select
  '00000000-0000-4000-8000-000000000843',
  'room-photos',
  account.id::text || '/00000000-0000-4000-8000-000000000812/original.jpg'
from public.customer_accounts account
where account.legacy_supabase_user_id = :'other_user_id'::uuid;

select plan(42);

select is(
  (select owner_account_id from public.vision_analysis_requests where id = '00000000-0000-4000-8000-000000000811'),
  (select id from public.customer_accounts where legacy_supabase_user_id = :'authenticated_user_id'::uuid),
  'legacy vision request backfills to its internal account'
);

select is(
  (select owner_account_id from public.room_scenes where id = '00000000-0000-4000-8000-000000000821'),
  (select id from public.customer_accounts where legacy_supabase_user_id = :'authenticated_user_id'::uuid),
  'legacy room scene backfills to its internal account'
);

select is(
  (select owner_account_id from public.vision_object_crops where id = '00000000-0000-4000-8000-000000000831'),
  (select id from public.customer_accounts where legacy_supabase_user_id = :'authenticated_user_id'::uuid),
  'legacy vision crop backfills to its internal account'
);

select is(
  (
    (select count(*) from public.vision_analysis_requests where owner_account_id is null)
    + (select count(*) from public.room_scenes where owner_account_id is null)
    + (select count(*) from public.vision_object_crops where owner_account_id is null)
  ),
  0::bigint,
  'vision ownership backfill leaves no account orphans'
);

select ok(
  (select owner_id from public.vision_analysis_requests where id = '00000000-0000-4000-8000-000000000811') = :'authenticated_user_id'::uuid,
  'legacy vision owner_id remains overlap metadata'
);

select ok(
  (select attnotnull from pg_attribute where attrelid = 'public.vision_analysis_requests'::regclass and attname = 'owner_account_id'),
  'vision requests require an internal account owner'
);

select ok(
  (select not attnotnull from pg_attribute where attrelid = 'public.vision_analysis_requests'::regclass and attname = 'owner_id'),
  'legacy vision owner_id is optional for account-only owners'
);

select ok(
  (select exists (
    select 1 from pg_constraint
    where conname = 'vision_analysis_requests_id_account_key'
      and conrelid = 'public.vision_analysis_requests'::regclass
  )),
  'requests expose an account-based composite key'
);

select ok(
  (select exists (
    select 1 from pg_constraint
    where conrelid = 'public.room_scenes'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%owner_account_id%'
  )),
  'scenes are bound to the request account through a composite foreign key'
);

select ok(
  (select exists (
    select 1 from pg_constraint
    where conrelid = 'public.vision_object_crops'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%owner_account_id%'
  )),
  'crops are bound to the request account through a composite foreign key'
);

select ok(
  (select pg_get_constraintdef(oid) like '%owner_account_id%'
   from pg_constraint where conname = 'vision_analysis_requests_original_path_layout'),
  'original path invariant is account-based'
);

select ok(
  (select pg_get_constraintdef(oid) like '%owner_account_id%'
   from pg_constraint where conname = 'vision_analysis_requests_normalized_path_layout'),
  'normalized path invariant is account-based'
);

select ok(
  (select pg_get_constraintdef(oid) like '%owner_account_id%'
   from pg_constraint where conname = 'vision_object_crops_path_layout'),
  'crop path invariant is account-based'
);

select ok(
  (select pg_get_constraintdef(oid) like '%owner_id%'
   from pg_constraint where conname = 'vision_analysis_requests_original_path_layout'),
  'original path invariant keeps an explicit legacy overlap rule'
);

select lives_ok(
  $$ insert into public.vision_analysis_requests (id, owner_id, owner_account_id, consent_policy_version, original_object_path, state, schema_version, idempotency_key)
     select '00000000-0000-4000-8000-000000000813', null, account.id, 'v1',
       account.id::text || '/00000000-0000-4000-8000-000000000813/original.jpg', 'pending', 'v1', 'vision-account-only-key'
     from public.customer_accounts account
     where account.legacy_supabase_user_id = '00000000-0000-4000-8000-000000000061' $$,
  'account-only owner can persist a request on the canonical account path'
);

select lives_ok(
  $$ insert into public.vision_analysis_requests (id, owner_id, consent_policy_version, original_object_path, state, schema_version, idempotency_key)
     values ('00000000-0000-4000-8000-000000000814', '00000000-0000-4000-8000-000000000061', 'v1',
       '00000000-0000-4000-8000-000000000061/00000000-0000-4000-8000-000000000814/original.jpg', 'pending', 'v1', 'vision-legacy-overlap-key') $$,
  'legacy owner path remains writable during the overlap window'
);

select throws_ok(
  $$ insert into public.vision_analysis_requests (id, owner_id, owner_account_id, consent_policy_version, original_object_path, state, schema_version, idempotency_key)
     select '00000000-0000-4000-8000-000000000815', null, account.id, 'v1',
       '00000000-0000-4000-8000-000000000999/00000000-0000-4000-8000-000000000815/original.jpg', 'pending', 'v1', 'vision-foreign-path-key'
     from public.customer_accounts account
     where account.legacy_supabase_user_id = '00000000-0000-4000-8000-000000000061' $$,
  '23514', null,
  'request path outside the owning account folder is rejected'
);

select throws_ok(
  $$ insert into public.vision_object_crops (id, request_id, owner_id, owner_account_id, object_category, bounding_box, object_path, object_hash)
     select '00000000-0000-4000-8000-000000000833', '00000000-0000-4000-8000-000000000811', null, account.id, 'sofa',
       '{"x": 0, "y": 0, "w": 1, "h": 1}'::jsonb,
       account.id::text || '/00000000-0000-4000-8000-000000000811/crop-2.jpg', 'crop-hash-foreign'
     from public.customer_accounts account
     where account.legacy_supabase_user_id = '00000000-0000-4000-8000-000000000062' $$,
  '23503', null,
  'crop cannot attach another account to an owned request'
);

select throws_ok(
  $$ insert into public.room_scenes (id, request_id, owner_id, owner_account_id, scene, mapper_version, provider_version)
     select '00000000-0000-4000-8000-000000000823', '00000000-0000-4000-8000-000000000813', null, account.id,
       '{"objects": []}'::jsonb, 'm1', 'p1'
     from public.customer_accounts account
     where account.legacy_supabase_user_id = '00000000-0000-4000-8000-000000000062' $$,
  '23503', null,
  'scene cannot attach another account to an owned request'
);

select throws_ok(
  $$ insert into public.vision_analysis_requests (id, owner_id, owner_account_id, consent_policy_version, state, schema_version, idempotency_key)
     select '00000000-0000-4000-8000-000000000816', '00000000-0000-4000-8000-000000000061', account.id, 'v1', 'pending', 'v1', 'vision-mismatch-key'
     from public.customer_accounts account
     where account.legacy_supabase_user_id = '00000000-0000-4000-8000-000000000062' $$,
  'P0001', 'legacy vision owner and account ownership must match',
  'legacy owner cannot be filed under another internal account'
);

select throws_ok(
  $$ insert into public.vision_analysis_requests (id, owner_id, owner_account_id, consent_policy_version, state, schema_version, idempotency_key)
     values ('00000000-0000-4000-8000-000000000817', null, null, 'v1', 'pending', 'v1', 'vision-unowned-key') $$,
  'P0001', 'vision record requires an internal account',
  'vision request without an internal account is rejected'
);

select throws_ok(
  $$ update public.vision_analysis_requests
     set owner_account_id = (select id from public.customer_accounts where legacy_supabase_user_id = '00000000-0000-4000-8000-000000000062')
     where id = '00000000-0000-4000-8000-000000000811' $$,
  'P0001', 'vision account ownership cannot be reassigned',
  'vision request ownership cannot be reassigned to another account'
);

select throws_ok(
  $$ update public.vision_object_crops
     set owner_account_id = (select id from public.customer_accounts where legacy_supabase_user_id = '00000000-0000-4000-8000-000000000062')
     where id = '00000000-0000-4000-8000-000000000831' $$,
  'P0001', 'vision account ownership cannot be reassigned',
  'vision crop ownership cannot be reassigned to another account'
);

select is(
  (select count(*) from pg_policies
   where tablename in ('vision_analysis_requests', 'room_scenes', 'vision_object_crops')
     and qual not like '%owner_account_id%'),
  0::bigint,
  'every vision policy is account scoped'
);

select ok(
  (select qual like '%is_room_photo_path_readable%'
   from pg_policies where policyname = 'room_photos_owner_read' and schemaname = 'storage'),
  'room photo read policy derives ownership from the internal account'
);

select is(
  (select public from storage.buckets where id = 'room-photos'),
  false,
  'room photos bucket stays private'
);

select is(
  (select count(*) from storage.buckets where public),
  0::bigint,
  'no public bucket is introduced'
);

select is(
  (select file_size_limit from storage.buckets where id = 'room-photos'),
  10485760::bigint,
  'private bucket size limit is preserved'
);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'foundation-vision-firebase-owner', 'role', 'authenticated', 'iss', 'https://securetoken.google.com/foundation-vision', 'aud', 'foundation-vision')::text, true);

select is(
  public.current_customer_account_id(),
  :'authenticated_user_id'::uuid,
  'mapped non-UUID Firebase subject resolves its internal vision account'
);

select is(
  (select count(*) from public.vision_analysis_requests where id = '00000000-0000-4000-8000-000000000812'),
  0::bigint,
  'Firebase owner cannot read another account vision request'
);

select is(
  (select count(*) from public.room_scenes where id = '00000000-0000-4000-8000-000000000822'),
  0::bigint,
  'Firebase owner cannot read another account room scene'
);

select is(
  (select count(*) from public.vision_object_crops where id = '00000000-0000-4000-8000-000000000832'),
  0::bigint,
  'Firebase owner cannot read another account vision crop'
);

select is(
  (select count(*) from public.room_scenes where id = '00000000-0000-4000-8000-000000000821'),
  1::bigint,
  'Firebase owner reads its own room scene'
);

select ok(
  public.is_room_photo_path_readable(
    (select account.id::text from public.customer_accounts account where account.legacy_supabase_user_id = '00000000-0000-4000-8000-000000000061')
    || '/00000000-0000-4000-8000-000000000811/original.jpg'
  ),
  'owner can read its canonical account storage path'
);

select ok(
  public.is_room_photo_path_readable('00000000-0000-4000-8000-000000000061/00000000-0000-4000-8000-000000000811/legacy-original.jpg'),
  'owner keeps legacy folder reads during the overlap window'
);

select ok(
  not public.is_room_photo_path_readable(
    (select account.id::text from public.customer_accounts account where account.legacy_supabase_user_id = '00000000-0000-4000-8000-000000000062')
    || '/00000000-0000-4000-8000-000000000812/original.jpg'
  ),
  'cross-account storage path read is denied'
);

select ok(
  not public.is_room_photo_path_readable(
    (select account.id::text from public.customer_accounts account where account.legacy_supabase_user_id = '00000000-0000-4000-8000-000000000061')
    || '/00000000-0000-4000-8000-000000000812/original.jpg'
  ),
  'own account folder cannot borrow another account request id'
);

select ok(
  not public.is_room_photo_path_readable('00000000-0000-4000-8000-000000000062/00000000-0000-4000-8000-000000000812/original.jpg'),
  'legacy overlap does not leak another legacy owner folder'
);

select is(
  has_function_privilege('anon', 'public.is_room_photo_path_readable(text)', 'execute'),
  false,
  'anon cannot probe room photo path ownership'
);

select is(
  has_function_privilege('authenticated', 'public.delete_vision_request(uuid)', 'execute'),
  false,
  'browser authenticated role cannot execute vision deletion'
);

set local role service_role;

select is(
  public.delete_vision_request('00000000-0000-4000-8000-000000000811'),
  2,
  'service deletion removes canonical and legacy objects for the target request'
);

select is(
  (select count(*) from storage.objects where id = '00000000-0000-4000-8000-000000000843'),
  1::bigint,
  'service deletion leaves another account objects untouched'
);

set local role postgres;

select * from finish();
rollback;
