-- pgTAP RLS test skeleton for nanohome-ecommerce.
--
-- Loaded by `supabase test` (which runs psql inside the local stack) or via:
--   psql -f supabase/tests/fixtures.sql -f supabase/tests/rls_test.sql \
--     "postgresql://postgres:postgres@localhost:54322/postgres"
--
-- Tests use a transaction BEGIN/ROLLBACK so no rows persist after the run.
-- Roles exercised by the developer via `SET LOCAL ROLE 'anon' | 'authenticated'`,
-- service-key behaviour is verified by the supabase client (service role
-- bypasses RLS entirely). The exact role-switching helpers are intentionally
-- left as TODO markers per task T8: this file is the *skeleton* declared in
-- the plan. Real assertions are added once the developer confirms local
-- Supabase pgTAP availability (T18).
--
-- Test roles (per plan line 250):
--   anon          -- unauthenticated browser request (anon key)
--   authenticated -- test user logged in (uid = auth.uid())
--   service       -- service role key; bypasses RLS

BEGIN;

\i supabase/tests/fixtures.sql

SELECT plan(6);

-- 1. carts/RLS: anon role cannot select carts seeded by an authenticated user.
-- TODO(T18): set role to anon, attempt select from public.carts where
-- user_id = :'authenticated_user_id'; expect 0 rows returned.
SELECT lives_ok(
  $$ SELECT 1 $$,
  'skeleton placeholder: anon cannot read carts owned by another user'
);

-- 2. cart_items/RLS: anon role cannot read rows through carts FK owner check.
SELECT lives_ok(
  $$ SELECT 1 $$,
  'skeleton placeholder: anon cannot read cart_items belonging to foreign carts'
);

-- 3. carts/RLS: authenticated role CAN read carts where user_id = auth.uid().
SELECT lives_ok(
  $$ SELECT 1 $$,
  'skeleton placeholder: authenticated user reads own carts'
);

-- 4. carts/RLS: authenticated role CANNOT read carts owned by another user.
SELECT lives_ok(
  $$ SELECT 1 $$,
  'skeleton placeholder: authenticated user cannot read other users carts (asserted via row count, not exception)'
);

-- 5. service role bypasses RLS: can select full carts/cart_items tables.
SELECT lives_ok(
  $$ SELECT 1 $$,
  'skeleton placeholder: service role reads all carts'
);

-- 6. orders/RLS: anon can read an order by setting app.order_number.
SELECT lives_ok(
  $$ SELECT 1 $$,
  'skeleton placeholder: anon reads own order by order_number setting'
);

SELECT * FROM finish();

ROLLBACK;