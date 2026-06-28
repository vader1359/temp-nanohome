-- Fixed deterministic UUIDs for nanohome-ecommerce supabase test fixtures.
--
-- These constants MUST be \set before including any test seed, fixture, or
-- pgTAP file. They use deterministic UUIDv4-shaped values (version nibble 4,
-- variant nibble 8) so they are RFC 9562 format-valid while still stable
-- across runs. psql meta-variables (:var_name) are substituted into the
-- consuming file's SQL; they are NOT valid identifiers when the file is
-- loaded directly by pgTAP without psql.
--
-- Load via: `psql -f supabase/tests/fixtures.sql -f supabase/seed.sql`.
\set brand_id_1    '00000000-0000-4000-8000-000000000001'
\set brand_id_2    '00000000-0000-4000-8000-000000000002'

\set cat_id_1      '00000000-0000-4000-8000-000000000011'
\set cat_id_2      '00000000-0000-4000-8000-000000000012'
\set cat_id_3      '00000000-0000-4000-8000-000000000013'

\set prod_id_1     '00000000-0000-4000-8000-000000000021'
\set prod_id_2     '00000000-0000-4000-8000-000000000022'
\set prod_id_3     '00000000-0000-4000-8000-000000000023'
\set prod_id_4     '00000000-0000-4000-8000-000000000024'
\set prod_id_5     '00000000-0000-4000-8000-000000000025'

\set variant_id_1  '00000000-0000-4000-8000-000000000031'
\set variant_id_2  '00000000-0000-4000-8000-000000000032'
\set variant_id_3  '00000000-0000-4000-8000-000000000033'
\set variant_id_4  '00000000-0000-4000-8000-000000000034'
\set variant_id_5  '00000000-0000-4000-8000-000000000035'
\set variant_id_6  '00000000-0000-4000-8000-000000000036'
\set variant_id_7  '00000000-0000-4000-8000-000000000037'
\set variant_id_8  '00000000-0000-4000-8000-000000000038'

\set news_id_1     '00000000-0000-4000-8000-000000000041'
\set news_id_2     '00000000-0000-4000-8000-000000000042'

\set catalog_id_1  '00000000-0000-4000-8000-000000000051'

\set authenticated_user_id '00000000-0000-4000-8000-000000000061'
\set other_user_id         '00000000-0000-4000-8000-000000000062'
\set cart_id_1             '00000000-0000-4000-8000-000000000071'
\set cart_id_2             '00000000-0000-4000-8000-000000000072'
\set cart_item_id_1        '00000000-0000-4000-8000-000000000081'
