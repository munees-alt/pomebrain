-- ====================================================================
-- SAFETY PATCH: workspace_model_keys functions were still anon-executable
-- ====================================================================
-- Supabase's public schema has default privileges that grant EXECUTE
-- directly to anon/authenticated/service_role at CREATE FUNCTION time -
-- not through the PUBLIC pseudo-role. REVOKE ... FROM PUBLIC (migration
-- 06) never touched those direct grants. Revoke from each named role
-- explicitly instead.

REVOKE EXECUTE ON FUNCTION public.set_workspace_model_key(UUID, VARCHAR, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_workspace_model_keys(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_workspace_model_key(UUID, VARCHAR) FROM anon;

-- get_workspace_model_key is the one function that can ever see a decrypted
-- key. Only the server (service_role) may call it - not anon, not authenticated.
REVOKE EXECUTE ON FUNCTION public.get_workspace_model_key(UUID, VARCHAR) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workspace_model_key(UUID, VARCHAR) FROM authenticated;
