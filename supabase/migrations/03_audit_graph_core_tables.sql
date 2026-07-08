-- ====================================================================
-- PHASE A SAFETY PATCH: AUDIT GRAPH CORE MUTATIONS
-- ====================================================================
-- The original audit writer only attaches to selected App Factory runtime
-- tables. This migration closes the graph-core audit gap without adding any
-- UPDATE/DELETE policy to public.audit_events.

CREATE OR REPLACE FUNCTION public.log_seed_version_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_workspace_id UUID;
    v_seed_id UUID;
BEGIN
    v_seed_id := COALESCE(NEW.seed_id, OLD.seed_id);

    SELECT workspace_id
    INTO v_workspace_id
    FROM public.seeds
    WHERE id = v_seed_id;

    INSERT INTO public.audit_events (
        workspace_id, actor_id, action_type, target_table, target_id,
        state_before, state_after
    ) VALUES (
        v_workspace_id,
        auth.uid(),
        TG_TABLE_NAME || '.' || lower(TG_OP),
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE '{}'::jsonb END,
        CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN to_jsonb(NEW) ELSE '{}'::jsonb END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_seeds ON public.seeds;
CREATE TRIGGER audit_seeds
    AFTER INSERT OR UPDATE OR DELETE ON public.seeds
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_seed_versions ON public.seed_versions;
CREATE TRIGGER audit_seed_versions
    AFTER INSERT OR UPDATE OR DELETE ON public.seed_versions
    FOR EACH ROW EXECUTE FUNCTION public.log_seed_version_audit_event();

DROP TRIGGER IF EXISTS audit_fibres ON public.fibres;
CREATE TRIGGER audit_fibres
    AFTER INSERT OR UPDATE OR DELETE ON public.fibres
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_projects ON public.projects;
CREATE TRIGGER audit_projects
    AFTER INSERT OR UPDATE OR DELETE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
