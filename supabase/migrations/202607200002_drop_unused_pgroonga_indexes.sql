-- Product search is served by pg_trgm. These PGroonga indexes are unused and
-- consume roughly 615 MB of extension-managed database storage.
drop index if exists public.products_pgroonga_idx;
drop index if exists public.variants_pgroonga_idx;
