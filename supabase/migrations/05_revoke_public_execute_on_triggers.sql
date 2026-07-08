-- ====================================================================
-- PHASE A SAFETY PATCH: CLOSE THE PUBLIC EXECUTE GRANT ON TRIGGER FUNCTIONS
-- ====================================================================
-- Migration 04 revoked EXECUTE from anon/authenticated directly, but
-- Postgres grants EXECUTE on new functions to the PUBLIC pseudo-role by
-- default, and anon/authenticated inherit through PUBLIC regardless of a
-- role-specific revoke. Revoking from PUBLIC is what actually closes the
-- RPC exposure. Trigger firing is unaffected: triggers invoke their
-- function directly and do not go through an EXECUTE privilege check.

REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_seed_version_audit_event() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
