-- ====================================================================
-- PHASE A SAFETY PATCH: HARDEN SECURITY DEFINER TRIGGER FUNCTIONS
-- ====================================================================
-- The Supabase security advisor flags two real issues on these functions:
--   1. Mutable search_path (a SECURITY DEFINER function without a fixed
--      search_path can be hijacked by objects created earlier in the path).
--   2. They are trigger functions, but Postgres/PostgREST still exposes
--      them as callable RPC endpoints to anon/authenticated by default.
-- Every reference inside these functions is already schema-qualified
-- (public.*, auth.*), so pinning an empty search_path changes nothing
-- functionally and closes the hijacking vector.

ALTER FUNCTION public.set_updated_at() SET search_path = '';
ALTER FUNCTION public.log_audit_event() SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.log_seed_version_audit_event() SET search_path = '';

-- These are trigger-only functions. No client role should ever call them
-- directly as an RPC.
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_seed_version_audit_event() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
