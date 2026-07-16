BEGIN;

SELECT plan(18);

SELECT has_table('public', 'brands', 'catalog baseline creates brands');
SELECT has_table('public', 'categories', 'catalog baseline creates categories');
SELECT has_table('public', 'designers', 'catalog baseline creates designers');
SELECT has_table('public', 'news', 'catalog baseline creates news');
SELECT has_table('public', 'catalogs', 'catalog baseline creates catalogs');
SELECT has_table('public', 'products', 'catalog baseline creates products');
SELECT has_table('public', 'variants', 'catalog baseline creates variants');
SELECT has_table('public', 'product_designers', 'catalog baseline creates product designers');
SELECT has_table('public', 'news_products', 'catalog baseline creates news products');
SELECT has_table('public', 'news_variants', 'catalog baseline creates news variants');

SELECT has_column('public', 'variants', 'stock', 'historical stock migration adds variant stock');
SELECT has_column('public', 'variants', 'name_ko', 'historical Korean migration adds Korean variant name');
SELECT has_pk('public', 'product_designers', 'product designers have a composite primary key');
SELECT has_pk('public', 'news_products', 'news products have a composite primary key');
SELECT has_pk('public', 'news_variants', 'news variants have a composite primary key');

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.cart_items'::regclass
      AND contype = 'f'
      AND confrelid = 'public.variants'::regclass
  ),
  'cart items reference catalog variants'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.order_items'::regclass
      AND contype = 'f'
      AND confrelid = 'public.variants'::regclass
  ),
  'order items reference catalog variants'
);
SELECT has_table('public', 'site_pages', 'CMS migrations apply after the catalog baseline');

SELECT * FROM finish();
ROLLBACK;
