-- Makes existing RLS policies reachable without widening policy scope.
grant select, insert, update, delete on public.carts, public.cart_items, public.orders, public.order_items, public.order_status_history, public.profiles, public.amis_sync_log to anon, authenticated;
grant select, update (stock) on public.variants to service_role;
