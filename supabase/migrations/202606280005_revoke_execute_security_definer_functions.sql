-- Revoke EXECUTE on SECURITY DEFINER trigger/helper functions from anon/authenticated/public.
-- These functions are only meant to be invoked by internal triggers, not via PostgREST REST API.
-- Without this migration, Supabase database-linter warns `anon_security_definer_function_executable`
-- and `authenticated_security_definer_function_executable` (the functions are still callable via
-- /rest/v1/rpc/<fn_name> by anon/authenticated roles despite being SECURITY DEFINER).

revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.set_profiles_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;