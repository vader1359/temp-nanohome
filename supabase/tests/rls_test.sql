BEGIN;

\ir fixtures.sql
\ir ../seed.sql

SET LOCAL ROLE postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  (:'authenticated_user_id', 'authenticated', 'authenticated', 'rls-owner@example.test', '', now()),
  (:'other_user_id', 'authenticated', 'authenticated', 'rls-other@example.test', '', now());

insert into public.carts (id, user_id)
values
  (:'cart_id_1', :'authenticated_user_id'),
  (:'cart_id_2', :'other_user_id');

insert into public.cart_items (id, cart_id, variant_id, quantity)
values (:'cart_item_id_1', :'cart_id_1', :'variant_id_1', 1);

insert into public.orders (id, order_number, user_id, email, full_name, phone, address, subtotal)
values
  (:'order_id_1', 'RLS-OWNER-ORDER', :'authenticated_user_id', 'rls-owner@example.test', 'Owner', '100', 'Owner address', 10),
  (:'order_id_2', 'RLS-OTHER-ORDER', :'other_user_id', 'rls-other@example.test', 'Other', '200', 'Other address', 20),
  (:'guest_order_id', 'RLS-GUEST-ORDER', null, 'rls-guest@example.test', 'Guest', '300', 'Guest address', 30);

insert into public.order_items (order_id, variant_id, product_name, variant_name, sku, price, quantity)
values
  (:'order_id_1', :'variant_id_1', 'Owner product', 'Owner variant', 'RLS-OWNER', 10, 1),
  (:'order_id_2', :'variant_id_1', 'Other product', 'Other variant', 'RLS-OTHER', 20, 1),
  (:'guest_order_id', :'variant_id_1', 'Guest product', 'Guest variant', 'RLS-GUEST', 30, 1);

insert into public.order_status_history (order_id, status, changed_by)
values
  (:'order_id_1', 'pending', :'authenticated_user_id'),
  (:'order_id_2', 'pending', :'other_user_id'),
  (:'guest_order_id', 'pending', null);

insert into public.amis_sync_log (status, items_processed)
values ('success', 1);

SELECT plan(105);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT is((SELECT origin_ko FROM public.brands WHERE id = :'brand_id_1'), '이탈리아', 'seeded brand exposes Korean origin');
SELECT is((SELECT name_ko FROM public.categories WHERE id = :'cat_id_2'), '의자', 'seeded category exposes Korean name');
SELECT is((SELECT name_ko FROM public.products WHERE id = :'prod_id_1'), '테스트 제품 1', 'seeded product exposes Korean name');
SELECT is((SELECT slug_ko FROM public.variants WHERE id = :'variant_id_1'), '테스트-옵션-1', 'seeded variant exposes Korean slug');
SELECT is((SELECT finish_ko FROM public.variants WHERE id = :'variant_id_1'), '무광 검정', 'seeded variant exposes Korean finish');
SELECT is((SELECT title_ko FROM public.news WHERE id = :'news_id_1'), '테스트 뉴스 1', 'seeded news exposes Korean title');
SELECT is((SELECT origin_ko FROM public.catalogs WHERE id = :'catalog_id_1'), '이탈리아', 'seeded catalog exposes Korean origin');
SELECT is((SELECT count(*) FROM public.carts), 0::bigint, 'anon cannot read carts');
SELECT throws_ok($$ insert into public.carts (guest_id) values ('forged-guest') $$, '42501', NULL, 'anon cannot insert carts');
with updated as (update public.carts set guest_id = 'forged-guest' returning 1)
select is((select count(*) from updated), 0::bigint, 'anon cannot update carts');
with deleted as (delete from public.carts returning 1)
select is((select count(*) from deleted), 0::bigint, 'anon cannot delete carts');
SELECT throws_ok($$ insert into public.cart_items (cart_id, variant_id, quantity) values ('00000000-0000-4000-8000-000000000071', '00000000-0000-4000-8000-000000000032', 1) $$, '42501', NULL, 'anon cannot insert cart items');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'authenticated_user_id', 'role', 'authenticated')::text, true);
SELECT set_config('request.jwt.claim.sub', :'authenticated_user_id', true);
SELECT is((SELECT count(*) FROM public.carts where id = :'cart_id_1'), 1::bigint, 'user reads own cart');
SELECT is((SELECT count(*) FROM public.carts where id = :'cart_id_2'), 0::bigint, 'user cannot read another cart');
SELECT lives_ok($$ update public.carts set guest_id = null where id = '00000000-0000-4000-8000-000000000071' $$, 'user updates own cart');
SELECT throws_ok($$ insert into public.carts (user_id) values ('00000000-0000-4000-8000-000000000062') $$, '42501', NULL, 'user cannot create another users cart');
SELECT is((SELECT count(*) FROM public.cart_items where cart_id = :'cart_id_1'), 1::bigint, 'user reads own cart items');
SELECT is((SELECT count(*) FROM public.cart_items where cart_id = :'cart_id_2'), 0::bigint, 'user cannot read another users cart items');
SELECT lives_ok($$ insert into public.cart_items (cart_id, variant_id, quantity) values ('00000000-0000-4000-8000-000000000071', '00000000-0000-4000-8000-000000000033', 1) $$, 'user adds an item to own cart');
SELECT throws_ok($$ insert into public.cart_items (cart_id, variant_id, quantity) values ('00000000-0000-4000-8000-000000000072', '00000000-0000-4000-8000-000000000033', 1) $$, '42501', NULL, 'user cannot add items to another users cart');

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('app.order_number', '', true);
SELECT is((SELECT count(*) FROM public.orders), 0::bigint, 'anon cannot read orders without an order number');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'authenticated_user_id', 'role', 'authenticated')::text, true);
SELECT set_config('request.jwt.claim.sub', :'authenticated_user_id', true);
SELECT is((SELECT count(*) FROM public.orders where id = :'order_id_1'), 1::bigint, 'user reads own order');
SELECT is((SELECT count(*) FROM public.orders where id = :'order_id_2'), 0::bigint, 'user cannot read another users order');
SELECT throws_ok($$ insert into public.orders (order_number, user_id, email, full_name, phone, address) values ('FORGED-AUTH-ORDER', '00000000-0000-4000-8000-000000000061', 'forged@example.test', 'Forged', '400', 'Forged address') $$, '42501', NULL, 'authenticated users cannot insert orders directly');

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('app.order_number', 'RLS-GUEST-ORDER', true);
SELECT is((SELECT count(*) FROM public.orders where id = :'guest_order_id'), 1::bigint, 'anon reads the requested guest order only');
SELECT throws_ok($$ insert into public.orders (order_number, email, full_name, phone, address) values ('FORGED-GUEST-ORDER', 'forged@example.test', 'Forged', '500', 'Forged address') $$, '42501', NULL, 'anon cannot insert orders directly');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'authenticated_user_id', 'role', 'authenticated')::text, true);
SELECT set_config('request.jwt.claim.sub', :'authenticated_user_id', true);
SELECT is((SELECT count(*) FROM public.order_items where order_id = :'order_id_1'), 1::bigint, 'user reads items in own order');
SELECT is((SELECT count(*) FROM public.order_items where order_id = :'order_id_2'), 0::bigint, 'user cannot read items in another users order');
SELECT throws_ok($$ insert into public.order_items (order_id, quantity) values ('00000000-0000-4000-8000-000000000091', 1) $$, '42501', NULL, 'user cannot insert order items directly');
SELECT is((SELECT count(*) FROM public.order_status_history where order_id = :'order_id_1'), 1::bigint, 'user reads own order history');
SELECT is((SELECT count(*) FROM public.order_status_history where order_id = :'order_id_2'), 0::bigint, 'user cannot read another users order history');
SELECT throws_ok($$ insert into public.order_status_history (order_id, status) values ('00000000-0000-4000-8000-000000000091', 'confirmed') $$, '42501', NULL, 'user cannot insert order history directly');

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('app.order_number', '', true);
SELECT is((SELECT count(*) FROM public.order_items), 0::bigint, 'anon cannot read order items without an order number');
SELECT is((SELECT count(*) FROM public.order_status_history), 0::bigint, 'anon cannot read order history');
SELECT throws_ok($$ insert into public.order_items (order_id, quantity) values ('00000000-0000-4000-8000-000000000093', 1) $$, '42501', NULL, 'anon cannot insert order items');
SELECT throws_ok($$ insert into public.order_status_history (order_id, status) values ('00000000-0000-4000-8000-000000000093', 'confirmed') $$, '42501', NULL, 'anon cannot insert order history');
SELECT set_config('app.order_number', 'RLS-GUEST-ORDER', true);
SELECT is((SELECT count(*) FROM public.order_items where order_id = :'guest_order_id'), 1::bigint, 'anon reads requested guest order items only');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'authenticated_user_id', 'role', 'authenticated')::text, true);
SELECT set_config('request.jwt.claim.sub', :'authenticated_user_id', true);
SELECT is((SELECT count(*) FROM public.profiles where id = :'authenticated_user_id'), 1::bigint, 'user reads own profile');
SELECT is((SELECT count(*) FROM public.profiles where id = :'other_user_id'), 0::bigint, 'user cannot read another users profile');
SELECT lives_ok($$ update public.profiles set full_name = 'Updated Owner' where id = '00000000-0000-4000-8000-000000000061' $$, 'user updates own profile');
SELECT lives_ok($$ update public.profiles set full_name = 'Blocked Update' where id = '00000000-0000-4000-8000-000000000062' $$, 'user cannot update another users profile');
SELECT is((SELECT count(*) FROM public.profiles where id = :'other_user_id' and full_name = 'Blocked Update'), 0::bigint, 'user cannot update another users profile');
SELECT is((SELECT count(*) FROM public.amis_sync_log), 0::bigint, 'authenticated users cannot read AMIS sync logs');
SELECT throws_ok($$ insert into public.amis_sync_log (status) values ('running') $$, '42501', NULL, 'authenticated users cannot write AMIS sync logs');

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT is((SELECT count(*) FROM public.profiles), 0::bigint, 'anon cannot read profiles');
SELECT throws_ok($$ insert into public.profiles (id) values ('00000000-0000-4000-8000-000000000062') $$, '42501', NULL, 'anon cannot write profiles');
SELECT is((SELECT count(*) FROM public.amis_sync_log), 0::bigint, 'anon cannot read AMIS sync logs');
SELECT throws_ok($$ insert into public.amis_sync_log (status) values ('running') $$, '42501', NULL, 'anon cannot write AMIS sync logs');
SELECT ok(not has_function_privilege('public.capture_order_from_cart(text, text, text, text, text, text, text, text)', 'execute'), 'anon lacks checkout RPC execute privilege');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'authenticated_user_id', 'role', 'authenticated')::text, true);
SELECT set_config('request.jwt.claim.sub', :'authenticated_user_id', true);
SELECT ok(has_function_privilege('public.capture_order_from_cart(text, text, text, text, text, text, text, text)', 'execute'), 'authenticated users have checkout RPC execute privilege');
SELECT is((SELECT count(*) FROM public.capture_order_from_cart('Checkout Owner', 'checkout-owner@example.test', '600', 'Checkout address')), 1::bigint, 'authenticated user captures their cart through the RPC');
SELECT is((SELECT subtotal FROM public.orders WHERE order_number LIKE 'ORD-%'), 30::numeric, 'checkout RPC calculates subtotal from persisted variants');
SELECT is((SELECT count(*) FROM public.order_items WHERE order_id = (SELECT id FROM public.orders WHERE order_number LIKE 'ORD-%')), 2::bigint, 'checkout RPC snapshots every cart item');
SELECT is((SELECT count(*) FROM public.order_status_history WHERE order_id = (SELECT id FROM public.orders WHERE order_number LIKE 'ORD-%')), 1::bigint, 'checkout RPC writes initial order history');
SELECT is((SELECT count(*) FROM public.cart_items WHERE cart_id = :'cart_id_1'), 0::bigint, 'checkout RPC clears only the captured cart');

-- Instagram pipeline security & validation tests
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT ok(not has_function_privilege('public.publish_instagram_snapshot(jsonb, text[], text)', 'execute'), 'anon lacks publish_instagram_snapshot RPC execute privilege');
SELECT throws_ok($$ select public.publish_instagram_snapshot('[]'::jsonb, ARRAY[]::text[], 'v1') $$, '42501', NULL, 'anon execution of publish_instagram_snapshot is blocked');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'authenticated_user_id', 'role', 'authenticated')::text, true);
SELECT ok(not has_function_privilege('public.publish_instagram_snapshot(jsonb, text[], text)', 'execute'), 'authenticated user lacks publish_instagram_snapshot RPC execute privilege');
SELECT throws_ok($$ select public.publish_instagram_snapshot('[]'::jsonb, ARRAY[]::text[], 'v1') $$, '42501', NULL, 'authenticated execution of publish_instagram_snapshot is blocked');

SET LOCAL ROLE service_role;
SELECT ok(has_function_privilege('public.publish_instagram_snapshot(jsonb, text[], text)', 'execute'), 'service_role has publish_instagram_snapshot RPC execute privilege');
SELECT throws_ok($$ select public.publish_instagram_snapshot('[]'::jsonb, ARRAY[]::text[], 'v1') $$, 'P0001', 'p_posts must contain exactly 24 candidate post objects', 'service_role composition validation rejects wrong candidate count');

-- Test 24 3/21 composition logic via publish_instagram_snapshot
-- Create 24 mock draft posts first (3 videos, 21 images) in public.instagram_posts
-- Let's construct candidate JSONB and active_ids array of size 24.
-- All candidate posts must have source_url_fingerprint and valid structure.
-- Let's use DO block or direct INSERTs to test.
DO $$
DECLARE
    v_posts JSONB := '[]';
    v_active_ids TEXT[] := ARRAY[]::TEXT[];
    v_post JSONB;
BEGIN
    FOR i IN 1..24 LOOP
        v_post := jsonb_build_object(
            'id', 'post-' || i,
            'media_type', CASE WHEN i <= 3 THEN 'video' ELSE 'image' END,
            'image_url', 'https://res.cloudinary.com/cloudname/image/upload/v1/post-' || i || '.jpg',
            'video_url', CASE WHEN i <= 3 THEN 'https://fast.wistia.net/embed/medias/abc' || i || '.mp4' ELSE NULL END,
            'thumbnail_url', CASE WHEN i <= 3 THEN 'https://res.cloudinary.com/cloudname/image/upload/v1/post-' || i || '-thumb.jpg' ELSE NULL END,
            'permalink', 'https://www.instagram.com/p/abc' || i || '/',
            'caption', 'Caption ' || i,
            'wistia_status', CASE WHEN i <= 3 THEN 'ready' ELSE NULL END,
            'source_url_fingerprint', 'fp-' || i
        );
        v_posts := v_posts || jsonb_build_array(v_post);
        v_active_ids := array_append(v_active_ids, 'post-' || i);
    END LOOP;

    -- This should succeed as composition is exactly 3 video and 21 image, all valid
    PERFORM public.publish_instagram_snapshot(v_posts, v_active_ids, 'v1');
END;
$$;

SELECT is((SELECT count(*) FROM public.instagram_active_posts), 24::bigint, '24 posts successfully published');
SELECT is((SELECT count(*) FROM public.instagram_active_posts WHERE media_type = 'video'), 3::bigint, 'exactly 3 video posts published');
SELECT is((SELECT count(*) FROM public.instagram_active_posts WHERE media_type = 'image'), 21::bigint, 'exactly 21 image posts published');
SELECT is((SELECT min(sort_order) FROM public.instagram_active_posts), 1, 'minimum sort_order is 1');
SELECT is((SELECT max(sort_order) FROM public.instagram_active_posts), 24, 'maximum sort_order is 24');

-- Test invalid composition rejects and does not corrupt existing active posts snapshot
SELECT throws_ok(
    $test$
    DO $do$
    DECLARE
        v_posts JSONB := '[]';
        v_active_ids TEXT[] := ARRAY[]::TEXT[];
        v_post JSONB;
    BEGIN
        -- 2 videos, 22 images
        FOR i IN 1..24 LOOP
            v_post := jsonb_build_object(
                'id', 'post-new-' || i,
                'media_type', CASE WHEN i <= 2 THEN 'video' ELSE 'image' END,
                'image_url', 'https://res.cloudinary.com/cloudname/image/upload/v1/post-' || i || '.jpg',
                'video_url', CASE WHEN i <= 2 THEN 'https://fast.wistia.net/embed/medias/abc' || i || '.mp4' ELSE NULL END,
                'thumbnail_url', CASE WHEN i <= 2 THEN 'https://res.cloudinary.com/cloudname/image/upload/v1/post-' || i || '-thumb.jpg' ELSE NULL END,
                'permalink', 'https://www.instagram.com/p/abc' || i || '/',
                'caption', 'Caption ' || i,
                'wistia_status', CASE WHEN i <= 2 THEN 'ready' ELSE NULL END,
                'source_url_fingerprint', 'fp-' || i
            );
            v_posts := v_posts || jsonb_build_array(v_post);
            v_active_ids := array_append(v_active_ids, 'post-new-' || i);
        END LOOP;
        PERFORM public.publish_instagram_snapshot(v_posts, v_active_ids, 'v2');
    END;
    $do$;
    $test$,
    'P0001',
    'Must have exactly 3 video posts, found 2',
    'Composition rejection for 2 videos and 22 images'
);

-- Ensure active posts snapshot remains untouched
SELECT is((SELECT count(*) FROM public.instagram_active_posts), 24::bigint, '24 posts snapshot remains intact after rejected update');
SELECT is((SELECT count(*) FROM public.instagram_active_posts WHERE id LIKE 'post-%' AND id NOT LIKE 'post-new-%'), 24::bigint, 'original active posts are retained');

-- Staged Instagram pipeline tests
SET LOCAL ROLE anon;
SELECT ok(not has_function_privilege('public.begin_instagram_snapshot_stage(jsonb, text, text)', 'execute'), 'anon lacks begin_instagram_snapshot_stage RPC execute privilege');
SELECT ok(not has_function_privilege('public.save_instagram_stage_drafts(uuid, jsonb)', 'execute'), 'anon lacks save_instagram_stage_drafts RPC execute privilege');
SELECT ok(not has_function_privilege('public.get_instagram_stage_work(uuid)', 'execute'), 'anon lacks get_instagram_stage_work RPC execute privilege');
SELECT ok(not has_function_privilege('public.get_instagram_stage_pending_videos(uuid)', 'execute'), 'anon lacks get_instagram_stage_pending_videos RPC execute privilege');
SELECT ok(not has_function_privilege('public.update_instagram_stage_wistia_status(uuid, text, text, text, text)', 'execute'), 'anon lacks update_instagram_stage_wistia_status RPC execute privilege');
SELECT ok(not has_function_privilege('public.publish_instagram_stage(uuid)', 'execute'), 'anon lacks publish_instagram_stage RPC execute privilege');

SET LOCAL ROLE authenticated;
SELECT ok(not has_function_privilege('public.begin_instagram_snapshot_stage(jsonb, text, text)', 'execute'), 'authenticated lacks begin_instagram_snapshot_stage RPC execute privilege');
SELECT ok(not has_function_privilege('public.save_instagram_stage_drafts(uuid, jsonb)', 'execute'), 'authenticated lacks save_instagram_stage_drafts RPC execute privilege');
SELECT ok(not has_function_privilege('public.get_instagram_stage_work(uuid)', 'execute'), 'authenticated lacks get_instagram_stage_work RPC execute privilege');
SELECT ok(not has_function_privilege('public.get_instagram_stage_pending_videos(uuid)', 'execute'), 'authenticated lacks get_instagram_stage_pending_videos RPC execute privilege');
SELECT ok(not has_function_privilege('public.update_instagram_stage_wistia_status(uuid, text, text, text, text)', 'execute'), 'authenticated lacks update_instagram_stage_wistia_status RPC execute privilege');
SELECT ok(not has_function_privilege('public.publish_instagram_stage(uuid)', 'execute'), 'authenticated lacks publish_instagram_stage RPC execute privilege');

SET LOCAL ROLE service_role;
SELECT ok(has_function_privilege('public.begin_instagram_snapshot_stage(jsonb, text, text)', 'execute'), 'service_role has begin_instagram_snapshot_stage RPC execute privilege');
SELECT ok(has_function_privilege('public.save_instagram_stage_drafts(uuid, jsonb)', 'execute'), 'service_role has save_instagram_stage_drafts RPC execute privilege');
SELECT ok(has_function_privilege('public.get_instagram_stage_work(uuid)', 'execute'), 'service_role has get_instagram_stage_work RPC execute privilege');
SELECT ok(has_function_privilege('public.get_instagram_stage_pending_videos(uuid)', 'execute'), 'service_role has get_instagram_stage_pending_videos RPC execute privilege');
SELECT ok(has_function_privilege('public.update_instagram_stage_wistia_status(uuid, text, text, text, text)', 'execute'), 'service_role has update_instagram_stage_wistia_status RPC execute privilege');
SELECT ok(has_function_privilege('public.publish_instagram_stage(uuid)', 'execute'), 'service_role has publish_instagram_stage RPC execute privilege');

-- Staged Functional Validation
SELECT lives_ok(
    $$ SELECT public.begin_instagram_snapshot_stage(
        (SELECT jsonb_agg(x) FROM (
            SELECT
                'stage-post-' || i AS id,
                CASE WHEN i <= 3 THEN 'video' ELSE 'image' END AS media_type,
                '1111111111111111111111111111111111111111111111111111111111111111' AS source_url_fingerprint,
                i AS sort_order,
                'https://www.instagram.com/p/stage' || i || '/' AS permalink,
                'Stage caption ' || i AS caption,
                'https://lookaside.fbsbx.com/stage-' || i || '.jpg' AS image_url,
                CASE WHEN i <= 3 THEN 'https://lookaside.fbsbx.com/stage-' || i || '.mp4' ELSE NULL END AS video_url
            FROM generate_series(1, 24) i
        ) x),
        'v1',
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    ) $$,
    'begin_instagram_snapshot_stage succeeds for valid composition'
);

SELECT ok(
    (SELECT count(*) FROM public.instagram_snapshot_stages WHERE selection_key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef') = 1,
    'stage is persisted in building status'
);

SELECT throws_ok(
    $$ SELECT public.begin_instagram_snapshot_stage(
        (SELECT jsonb_agg(x) FROM (
            SELECT
                'other-post-' || i AS id,
                CASE WHEN i <= 3 THEN 'video' ELSE 'image' END AS media_type,
                '2222222222222222222222222222222222222222222222222222222222222222' AS source_url_fingerprint,
                i AS sort_order,
                'https://www.instagram.com/p/other' || i || '/' AS permalink,
                'Other caption ' || i AS caption,
                'https://lookaside.fbsbx.com/other-' || i || '.jpg' AS image_url,
                CASE WHEN i <= 3 THEN 'https://lookaside.fbsbx.com/other-' || i || '.mp4' ELSE NULL END AS video_url
            FROM generate_series(1, 24) i
        ) x),
        'v1',
        '9999999999999999999999999999999999999999999999999999999999999999'
    ) $$,
    'P0001',
    NULL,
    'begin_instagram_snapshot_stage prevents concurrent building/ready stages'
);

SELECT throws_ok(
    $$ SELECT public.save_instagram_stage_drafts(
        (SELECT id FROM public.instagram_snapshot_stages LIMIT 1),
        '[]'::jsonb
    ) $$,
    'P0001',
    'p_posts must contain between 1 and 2 posts',
    'save_instagram_stage_drafts rejects empty posts array'
);

SELECT throws_ok(
    $$ SELECT public.save_instagram_stage_drafts(
        (SELECT id FROM public.instagram_snapshot_stages LIMIT 1),
        '[1, 2, 3]'::jsonb
    ) $$,
    'P0001',
    'p_posts must contain between 1 and 2 posts',
    'save_instagram_stage_drafts rejects array of length 3'
);

SELECT throws_ok(
    $$ SELECT public.save_instagram_stage_drafts(
        (SELECT id FROM public.instagram_snapshot_stages LIMIT 1),
        jsonb_build_array(
            jsonb_build_object(
                'id', 'stage-post-1',
                'media_type', 'video',
                'image_url', 'https://res.cloudinary.com/ok-1.jpg',
                'video_url', 'https://fast.wistia.com/1.mp4',
                'thumbnail_url', 'https://res.cloudinary.com/ok-t-1.jpg',
                'permalink', 'https://www.instagram.com/p/stage1/',
                'caption', 'wrong caption',
                'wistia_hashed_id', 'w1',
                'wistia_status', 'ready',
                'source_url_fingerprint', '1111111111111111111111111111111111111111111111111111111111111111'
            )
        )
    ) $$,
    'P0001',
    'Caption mismatch for post stage-post-1',
    'save_instagram_stage_drafts rejects caption mismatch'
);

SELECT throws_ok(
    $$ SELECT public.save_instagram_stage_drafts(
        (SELECT id FROM public.instagram_snapshot_stages LIMIT 1),
        jsonb_build_array(
            jsonb_build_object(
                'id', 'stage-post-1',
                'media_type', 'video',
                'image_url', 'https://res.cloudinary.com/ok-1.jpg',
                'video_url', 'https://fast.wistia.com/1.mp4',
                'thumbnail_url', 'https://res.cloudinary.com/ok-t-1.jpg',
                'permalink', 'https://www.instagram.com/p/wrongpermalink/',
                'caption', 'Stage caption 1',
                'wistia_hashed_id', 'w1',
                'wistia_status', 'ready',
                'source_url_fingerprint', '1111111111111111111111111111111111111111111111111111111111111111'
            )
        )
    ) $$,
    'P0001',
    'Permalink mismatch for post stage-post-1: stage expected https://www.instagram.com/p/stage1/, got https://www.instagram.com/p/wrongpermalink/',
    'save_instagram_stage_drafts rejects permalink mismatch'
);

SELECT throws_ok(
    $$ SELECT public.save_instagram_stage_drafts(
        (SELECT id FROM public.instagram_snapshot_stages LIMIT 1),
        jsonb_build_array(
            jsonb_build_object(
                'id', 'stage-post-4',
                'media_type', 'image',
                'image_url', 'https://res.cloudinary.com/ok-4.jpg',
                'thumbnail_url', 'https://res.cloudinary.com/ok-t-4.jpg',
                'permalink', 'https://www.instagram.com/p/stage4/',
                'caption', 'Stage caption 4',
                'source_url_fingerprint', '1111111111111111111111111111111111111111111111111111111111111111'
            )
        )
    ) $$,
    'P0001',
    'Image post stage-post-4 cannot have video fields, Wistia status, or thumbnail',
    'save_instagram_stage_drafts rejects image post with thumbnail'
);

SELECT throws_ok(
    $$ SELECT public.update_instagram_stage_wistia_status(
        (SELECT id FROM public.instagram_snapshot_stages LIMIT 1),
        'stage-post-4',
        '1111111111111111111111111111111111111111111111111111111111111111',
        'failed',
        NULL
    ) $$,
    'P0001',
    'No matching video item for post stage-post-4 and fingerprint 1111111111111111111111111111111111111111111111111111111111111111 in stage %',
    'update_instagram_stage_wistia_status rejects non-video posts'
);

SELECT lives_ok(
    $$ SELECT public.save_instagram_stage_drafts(
        (SELECT id FROM public.instagram_snapshot_stages LIMIT 1),
        jsonb_build_array(
            jsonb_build_object(
                'id', 'stage-post-1',
                'media_type', 'video',
                'image_url', 'https://res.cloudinary.com/ok-1.jpg',
                'video_url', 'https://fast.wistia.com/1.mp4',
                'thumbnail_url', 'https://res.cloudinary.com/ok-t-1.jpg',
                'permalink', 'https://www.instagram.com/p/stage1/',
                'caption', 'Stage caption 1',
                'wistia_hashed_id', 'w1',
                'wistia_status', 'ready',
                'source_url_fingerprint', '1111111111111111111111111111111111111111111111111111111111111111'
            )
        )
    ) $$,
    'save video draft successfully'
);

SELECT lives_ok(
    $$ SELECT public.update_instagram_stage_wistia_status(
        (SELECT id FROM public.instagram_snapshot_stages LIMIT 1),
        'stage-post-1',
        '1111111111111111111111111111111111111111111111111111111111111111',
        'failed',
        NULL
    ) $$,
    'wistia status update to failed works'
);

SELECT is(
    (SELECT video_url FROM public.instagram_posts WHERE id = 'stage-post-1'),
    NULL,
    'video_url is cleared when wistia status is non-ready'
);

-- Populate all 24 ready posts
DO $$
DECLARE
    v_stage_id UUID;
    v_drafts JSONB;
BEGIN
    SELECT id INTO v_stage_id FROM public.instagram_snapshot_stages LIMIT 1;
    FOR i IN 1..24 LOOP
        v_drafts := jsonb_build_array(
            jsonb_build_object(
                'id', 'stage-post-' || i,
                'media_type', CASE WHEN i <= 3 THEN 'video' ELSE 'image' END,
                'image_url', 'https://res.cloudinary.com/ok-' || i || '.jpg',
                'video_url', CASE WHEN i <= 3 THEN 'https://fast.wistia.com/' || i || '.mp4' ELSE NULL END,
                'thumbnail_url', CASE WHEN i <= 3 THEN 'https://res.cloudinary.com/ok-t-' || i || '.jpg' ELSE NULL END,
                'permalink', 'https://www.instagram.com/p/stage' || i || '/',
                'caption', 'Stage caption ' || i,
                'wistia_hashed_id', CASE WHEN i <= 3 THEN 'w' || i ELSE NULL END,
                'wistia_status', CASE WHEN i <= 3 THEN 'ready' ELSE NULL END,
                'source_url_fingerprint', '1111111111111111111111111111111111111111111111111111111111111111'
            )
        );
        PERFORM public.save_instagram_stage_drafts(v_stage_id, v_drafts);
    END LOOP;
END;
$$;

SELECT is(
    (SELECT public.publish_instagram_stage((SELECT id FROM public.instagram_snapshot_stages LIMIT 1))),
    'published',
    'publish_instagram_stage succeeds when all 24 are ready'
);

SELECT is(
    (SELECT count(*)::integer FROM public.instagram_active_posts WHERE id LIKE 'stage-post-%'),
    24,
    'exactly 24 active posts published'
);

-- Target tests for reel permalink validation
-- Valid /reel/ accepted
SELECT lives_ok(
    $$ SELECT public.begin_instagram_snapshot_stage(
        (SELECT jsonb_agg(x) FROM (
            SELECT
                'reel-post-' || i AS id,
                CASE WHEN i <= 3 THEN 'video' ELSE 'image' END AS media_type,
                '3333333333333333333333333333333333333333333333333333333333333333' AS source_url_fingerprint,
                i AS sort_order,
                CASE WHEN i = 1 THEN 'https://www.instagram.com/reel/validreel/' ELSE 'https://www.instagram.com/p/stage' || i || '/' END AS permalink,
                'Reel caption ' || i AS caption,
                'https://lookaside.fbsbx.com/reel-' || i || '.jpg' AS image_url,
                CASE WHEN i <= 3 THEN 'https://lookaside.fbsbx.com/reel-' || i || '.mp4' ELSE NULL END AS video_url
            FROM generate_series(1, 24) i
        ) x),
        'v1',
        '0000000000000000000000000000000000000000000000000000000000000002'
    ) $$,
    'begin_instagram_snapshot_stage accepts valid /reel/ permalinks'
);

-- Invalid /reel/<id>/extra rejected
SELECT throws_ok(
    $$ SELECT public.begin_instagram_snapshot_stage(
        (SELECT jsonb_agg(x) FROM (
            SELECT
                'reel-post-bad-' || i AS id,
                CASE WHEN i <= 3 THEN 'video' ELSE 'image' END AS media_type,
                '4444444444444444444444444444444444444444444444444444444444444444' AS source_url_fingerprint,
                i AS sort_order,
                CASE WHEN i = 1 THEN 'https://www.instagram.com/reel/validreel/extra' ELSE 'https://www.instagram.com/p/stage' || i || '/' END AS permalink,
                'Reel caption ' || i AS caption,
                'https://lookaside.fbsbx.com/reel-bad-' || i || '.jpg' AS image_url,
                CASE WHEN i <= 3 THEN 'https://lookaside.fbsbx.com/reel-bad-' || i || '.mp4' ELSE NULL END AS video_url
            FROM generate_series(1, 24) i
        ) x),
        'v1',
        '0000000000000000000000000000000000000000000000000000000000000003'
    ) $$,
    'P0001',
    'Invalid permalink found in selection',
    'begin_instagram_snapshot_stage rejects /reel/<id>/extra'
);

-- Invalid reel permalinks with query params rejected
SELECT throws_ok(
    $$ SELECT public.begin_instagram_snapshot_stage(
        (SELECT jsonb_agg(x) FROM (
            SELECT
                'reel-post-bad2-' || i AS id,
                CASE WHEN i <= 3 THEN 'video' ELSE 'image' END AS media_type,
                '5555555555555555555555555555555555555555555555555555555555555555' AS source_url_fingerprint,
                i AS sort_order,
                CASE WHEN i = 1 THEN 'https://www.instagram.com/reel/validreel/?utm_source=ig' ELSE 'https://www.instagram.com/p/stage' || i || '/' END AS permalink,
                'Reel caption ' || i AS caption,
                'https://lookaside.fbsbx.com/reel-bad2-' || i || '.jpg' AS image_url,
                CASE WHEN i <= 3 THEN 'https://lookaside.fbsbx.com/reel-bad2-' || i || '.mp4' ELSE NULL END AS video_url
            FROM generate_series(1, 24) i
        ) x),
        'v1',
        '0000000000000000000000000000000000000000000000000000000000000004'
    ) $$,
    'P0001',
    'Invalid permalink found in selection',
    'begin_instagram_snapshot_stage rejects /reel/<id>/ with query parameters'
);

-- Invalid reel permalinks with fragments rejected
SELECT throws_ok(
    $$ SELECT public.begin_instagram_snapshot_stage(
        (SELECT jsonb_agg(x) FROM (
            SELECT
                'reel-post-bad3-' || i AS id,
                CASE WHEN i <= 3 THEN 'video' ELSE 'image' END AS media_type,
                '6666666666666666666666666666666666666666666666666666666666666666' AS source_url_fingerprint,
                i AS sort_order,
                CASE WHEN i = 1 THEN 'https://www.instagram.com/reel/validreel/#hash' ELSE 'https://www.instagram.com/p/stage' || i || '/' END AS permalink,
                'Reel caption ' || i AS caption,
                'https://lookaside.fbsbx.com/reel-bad3-' || i || '.jpg' AS image_url,
                CASE WHEN i <= 3 THEN 'https://lookaside.fbsbx.com/reel-bad3-' || i || '.mp4' ELSE NULL END AS video_url
            FROM generate_series(1, 24) i
        ) x),
        'v1',
        '0000000000000000000000000000000000000000000000000000000000000005'
    ) $$,
    'P0001',
    'Invalid permalink found in selection',
    'begin_instagram_snapshot_stage rejects /reel/<id>/ with fragment'
);

SELECT * FROM finish();
ROLLBACK;
