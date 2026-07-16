BEGIN;

\ir fixtures.sql

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

insert into public.designers (id, name, validated, approved)
values ('00000000-0000-4000-8000-000000000014', 'RLS Designer', true, true)
on conflict do nothing;
insert into public.product_designers (product_id, designer_id)
values (:'prod_id_1', '00000000-0000-4000-8000-000000000014') on conflict do nothing;
insert into public.news_products (news_id, product_id)
values (:'news_id_1', :'prod_id_1') on conflict do nothing;
insert into public.news_variants (news_id, variant_id)
values (:'news_id_1', :'variant_id_1') on conflict do nothing;

SELECT plan(115);

SELECT ok((select relrowsecurity from pg_class where oid = 'public.brands'::regclass), 'brands enable RLS');
SELECT ok((select relrowsecurity from pg_class where oid = 'public.categories'::regclass), 'categories enable RLS');
SELECT ok((select relrowsecurity from pg_class where oid = 'public.designers'::regclass), 'designers enable RLS');
SELECT ok((select relrowsecurity from pg_class where oid = 'public.news'::regclass), 'news enable RLS');
SELECT ok((select relrowsecurity from pg_class where oid = 'public.catalogs'::regclass), 'catalogs enable RLS');
SELECT ok((select relrowsecurity from pg_class where oid = 'public.products'::regclass), 'products enable RLS');
SELECT ok((select relrowsecurity from pg_class where oid = 'public.variants'::regclass), 'variants enable RLS');
SELECT ok((select relrowsecurity from pg_class where oid = 'public.product_designers'::regclass), 'product designers enable RLS');
SELECT ok((select relrowsecurity from pg_class where oid = 'public.news_products'::regclass), 'news products enable RLS');
SELECT ok((select relrowsecurity from pg_class where oid = 'public.news_variants'::regclass), 'news variants enable RLS');

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
SELECT is((SELECT count(*) FROM public.brands WHERE id = :'brand_id_1'), 1::bigint, 'anon reads validated brands');
SELECT is((SELECT count(*) FROM public.categories WHERE id = :'cat_id_2'), 1::bigint, 'anon reads approved validated categories');
SELECT is((SELECT count(*) FROM public.designers), 1::bigint, 'anon reads validated designers');
SELECT is((SELECT count(*) FROM public.news WHERE id = :'news_id_1'), 1::bigint, 'anon reads validated news');
SELECT is((SELECT count(*) FROM public.catalogs WHERE id = :'catalog_id_1'), 1::bigint, 'anon reads catalogs');
SELECT is((SELECT count(*) FROM public.products WHERE id = :'prod_id_1'), 1::bigint, 'anon reads validated products');
SELECT is((SELECT count(*) FROM public.variants WHERE id = :'variant_id_1'), 1::bigint, 'anon reads validated variants');
SELECT is((SELECT count(*) FROM public.product_designers WHERE product_id = :'prod_id_1'), 1::bigint, 'anon reads product designers');
SELECT is((SELECT count(*) FROM public.news_products WHERE news_id = :'news_id_1' and product_id = :'prod_id_1'), 1::bigint, 'anon reads news products');
SELECT is((SELECT count(*) FROM public.news_variants WHERE news_id = :'news_id_1' and variant_id = :'variant_id_1'), 1::bigint, 'anon reads news variants');
SELECT throws_ok($$ insert into public.brands default values $$, '42501', NULL, 'anon cannot insert brands');
SELECT throws_ok($$ insert into public.categories default values $$, '42501', NULL, 'anon cannot insert categories');
SELECT throws_ok($$ insert into public.designers default values $$, '42501', NULL, 'anon cannot insert designers');
SELECT throws_ok($$ insert into public.news default values $$, '42501', NULL, 'anon cannot insert news');
SELECT throws_ok($$ insert into public.catalogs default values $$, '42501', NULL, 'anon cannot insert catalogs');
SELECT throws_ok($$ insert into public.products default values $$, '42501', NULL, 'anon cannot insert products');
SELECT throws_ok($$ insert into public.variants default values $$, '42501', NULL, 'anon cannot insert variants');
SELECT throws_ok($$ insert into public.product_designers default values $$, '42501', NULL, 'anon cannot insert product designers');
SELECT throws_ok($$ insert into public.news_products default values $$, '42501', NULL, 'anon cannot insert news products');
SELECT throws_ok($$ insert into public.news_variants default values $$, '42501', NULL, 'anon cannot insert news variants');
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
SELECT is((SELECT count(*) FROM public.brands WHERE id = :'brand_id_1'), 1::bigint, 'authenticated reads validated brands');
SELECT is((SELECT count(*) FROM public.categories WHERE id = :'cat_id_2'), 1::bigint, 'authenticated reads approved validated categories');
SELECT is((SELECT count(*) FROM public.designers), 1::bigint, 'authenticated reads validated designers');
SELECT is((SELECT count(*) FROM public.news WHERE id = :'news_id_1'), 1::bigint, 'authenticated reads validated news');
SELECT is((SELECT count(*) FROM public.catalogs WHERE id = :'catalog_id_1'), 1::bigint, 'authenticated reads catalogs');
SELECT is((SELECT count(*) FROM public.products WHERE id = :'prod_id_1'), 1::bigint, 'authenticated reads validated products');
SELECT is((SELECT count(*) FROM public.variants WHERE id = :'variant_id_1'), 1::bigint, 'authenticated reads validated variants');
SELECT is((SELECT count(*) FROM public.product_designers WHERE product_id = :'prod_id_1'), 1::bigint, 'authenticated reads product designers');
SELECT is((SELECT count(*) FROM public.news_products WHERE news_id = :'news_id_1' and product_id = :'prod_id_1'), 1::bigint, 'authenticated reads news products');
SELECT is((SELECT count(*) FROM public.news_variants WHERE news_id = :'news_id_1' and variant_id = :'variant_id_1'), 1::bigint, 'authenticated reads news variants');
SELECT throws_ok($$ insert into public.brands default values $$, '42501', NULL, 'authenticated cannot insert brands');
SELECT throws_ok($$ insert into public.categories default values $$, '42501', NULL, 'authenticated cannot insert categories');
SELECT throws_ok($$ insert into public.designers default values $$, '42501', NULL, 'authenticated cannot insert designers');
SELECT throws_ok($$ insert into public.news default values $$, '42501', NULL, 'authenticated cannot insert news');
SELECT throws_ok($$ insert into public.catalogs default values $$, '42501', NULL, 'authenticated cannot insert catalogs');
SELECT throws_ok($$ insert into public.products default values $$, '42501', NULL, 'authenticated cannot insert products');
SELECT throws_ok($$ insert into public.variants default values $$, '42501', NULL, 'authenticated cannot insert variants');
SELECT throws_ok($$ insert into public.product_designers default values $$, '42501', NULL, 'authenticated cannot insert product designers');
SELECT throws_ok($$ insert into public.news_products default values $$, '42501', NULL, 'authenticated cannot insert news products');
SELECT throws_ok($$ insert into public.news_variants default values $$, '42501', NULL, 'authenticated cannot insert news variants');
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

SELECT ok(not has_table_privilege('anon', 'public.brands', 'insert') and not has_table_privilege('anon', 'public.brands', 'update') and not has_table_privilege('anon', 'public.brands', 'delete') and not has_table_privilege('authenticated', 'public.brands', 'insert') and not has_table_privilege('authenticated', 'public.brands', 'update') and not has_table_privilege('authenticated', 'public.brands', 'delete'), 'storefront roles lack brand writes');
SELECT ok(not has_table_privilege('anon', 'public.categories', 'insert') and not has_table_privilege('anon', 'public.categories', 'update') and not has_table_privilege('anon', 'public.categories', 'delete') and not has_table_privilege('authenticated', 'public.categories', 'insert') and not has_table_privilege('authenticated', 'public.categories', 'update') and not has_table_privilege('authenticated', 'public.categories', 'delete'), 'storefront roles lack category writes');
SELECT ok(not has_table_privilege('anon', 'public.designers', 'insert') and not has_table_privilege('anon', 'public.designers', 'update') and not has_table_privilege('anon', 'public.designers', 'delete') and not has_table_privilege('authenticated', 'public.designers', 'insert') and not has_table_privilege('authenticated', 'public.designers', 'update') and not has_table_privilege('authenticated', 'public.designers', 'delete'), 'storefront roles lack designer writes');
SELECT ok(not has_table_privilege('anon', 'public.news', 'insert') and not has_table_privilege('anon', 'public.news', 'update') and not has_table_privilege('anon', 'public.news', 'delete') and not has_table_privilege('authenticated', 'public.news', 'insert') and not has_table_privilege('authenticated', 'public.news', 'update') and not has_table_privilege('authenticated', 'public.news', 'delete'), 'storefront roles lack news writes');
SELECT ok(not has_table_privilege('anon', 'public.catalogs', 'insert') and not has_table_privilege('anon', 'public.catalogs', 'update') and not has_table_privilege('anon', 'public.catalogs', 'delete') and not has_table_privilege('authenticated', 'public.catalogs', 'insert') and not has_table_privilege('authenticated', 'public.catalogs', 'update') and not has_table_privilege('authenticated', 'public.catalogs', 'delete'), 'storefront roles lack catalog writes');
SELECT ok(not has_table_privilege('anon', 'public.products', 'insert') and not has_table_privilege('anon', 'public.products', 'update') and not has_table_privilege('anon', 'public.products', 'delete') and not has_table_privilege('authenticated', 'public.products', 'insert') and not has_table_privilege('authenticated', 'public.products', 'update') and not has_table_privilege('authenticated', 'public.products', 'delete'), 'storefront roles lack product writes');
SELECT ok(not has_table_privilege('anon', 'public.variants', 'insert') and not has_table_privilege('anon', 'public.variants', 'update') and not has_table_privilege('anon', 'public.variants', 'delete') and not has_table_privilege('authenticated', 'public.variants', 'insert') and not has_table_privilege('authenticated', 'public.variants', 'update') and not has_table_privilege('authenticated', 'public.variants', 'delete'), 'storefront roles lack variant writes');
SELECT ok(not has_table_privilege('anon', 'public.product_designers', 'insert') and not has_table_privilege('anon', 'public.product_designers', 'update') and not has_table_privilege('anon', 'public.product_designers', 'delete') and not has_table_privilege('authenticated', 'public.product_designers', 'insert') and not has_table_privilege('authenticated', 'public.product_designers', 'update') and not has_table_privilege('authenticated', 'public.product_designers', 'delete'), 'storefront roles lack product designer writes');
SELECT ok(not has_table_privilege('anon', 'public.news_products', 'insert') and not has_table_privilege('anon', 'public.news_products', 'update') and not has_table_privilege('anon', 'public.news_products', 'delete') and not has_table_privilege('authenticated', 'public.news_products', 'insert') and not has_table_privilege('authenticated', 'public.news_products', 'update') and not has_table_privilege('authenticated', 'public.news_products', 'delete'), 'storefront roles lack news product writes');
SELECT ok(not has_table_privilege('anon', 'public.news_variants', 'insert') and not has_table_privilege('anon', 'public.news_variants', 'update') and not has_table_privilege('anon', 'public.news_variants', 'delete') and not has_table_privilege('authenticated', 'public.news_variants', 'insert') and not has_table_privilege('authenticated', 'public.news_variants', 'update') and not has_table_privilege('authenticated', 'public.news_variants', 'delete'), 'storefront roles lack news variant writes');

SELECT * FROM finish();
ROLLBACK;
