-- ====================================================================
-- MONETIZATION FOUNDATION: TRIALS, SUBSCRIPTIONS, AND USAGE
-- ====================================================================
-- New workspaces can use all protected agents for one month. After the trial,
-- App Factory build runs require an active paid subscription or explicit
-- admin-granted entitlement.

CREATE TABLE public.workspace_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    plan_slug VARCHAR(60) NOT NULL DEFAULT 'free_trial',
    status VARCHAR(40) NOT NULL DEFAULT 'trialing'
        CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'admin_grant')),
    monthly_build_limit INT,
    monthly_agent_execution_limit INT,
    trial_started_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    current_period_started_at TIMESTAMPTZ,
    current_period_ends_at TIMESTAMPTZ,
    external_customer_id TEXT,
    external_subscription_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_workspace_subscription UNIQUE (workspace_id)
);

CREATE TABLE public.workspace_usage_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    usage_type VARCHAR(60) NOT NULL CHECK (usage_type IN ('crown_run', 'agent_execution', 'connector_action')),
    units INT NOT NULL DEFAULT 1 CHECK (units > 0),
    source_id UUID,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.workspace_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_usage_ledger ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trigger_workspace_subscriptions_updated_at
    BEFORE UPDATE ON public.workspace_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY tenant_workspace_subscriptions_read ON public.workspace_subscriptions
    FOR SELECT
    USING (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid);

CREATE POLICY tenant_workspace_usage_read ON public.workspace_usage_ledger
    FOR SELECT
    USING (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid);

CREATE POLICY tenant_workspace_usage_insert ON public.workspace_usage_ledger
    FOR INSERT
    WITH CHECK (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid);

CREATE OR REPLACE FUNCTION public.get_workspace_entitlement(p_workspace_id UUID)
RETURNS TABLE (
    plan_slug TEXT,
    status TEXT,
    trial_ends_at TIMESTAMPTZ,
    days_remaining INT,
    can_build BOOLEAN,
    reason TEXT
) AS $$
DECLARE
    v_caller_workspace UUID;
    v_workspace_created_at TIMESTAMPTZ;
    v_subscription public.workspace_subscriptions%ROWTYPE;
    v_trial_ends_at TIMESTAMPTZ;
BEGIN
    v_caller_workspace := ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid;

    IF v_caller_workspace IS NULL OR v_caller_workspace <> p_workspace_id THEN
        RAISE EXCEPTION 'Not authorized to view entitlement for this workspace.';
    END IF;

    SELECT created_at INTO v_workspace_created_at
    FROM public.workspaces
    WHERE id = p_workspace_id;

    IF v_workspace_created_at IS NULL THEN
        RAISE EXCEPTION 'Workspace not found.';
    END IF;

    SELECT * INTO v_subscription
    FROM public.workspace_subscriptions
    WHERE workspace_id = p_workspace_id;

    IF v_subscription.id IS NOT NULL AND v_subscription.status IN ('active', 'admin_grant') THEN
        RETURN QUERY SELECT
            v_subscription.plan_slug::TEXT,
            v_subscription.status::TEXT,
            v_subscription.trial_ends_at,
            NULL::INT,
            TRUE,
            'paid_or_admin_entitlement'::TEXT;
        RETURN;
    END IF;

    v_trial_ends_at := COALESCE(v_subscription.trial_ends_at, v_workspace_created_at + interval '1 month');

    RETURN QUERY SELECT
        COALESCE(v_subscription.plan_slug, 'free_trial')::TEXT,
        CASE WHEN timezone('utc', now()) <= v_trial_ends_at THEN 'trialing' ELSE 'trial_expired' END::TEXT,
        v_trial_ends_at,
        GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_trial_ends_at - timezone('utc', now()))) / 86400)::INT),
        timezone('utc', now()) <= v_trial_ends_at,
        CASE
            WHEN timezone('utc', now()) <= v_trial_ends_at THEN 'free_trial_active'
            ELSE 'trial_expired_paid_plan_required'
        END::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.record_workspace_usage(
    p_workspace_id UUID,
    p_usage_type VARCHAR(60),
    p_units INT,
    p_source_id UUID,
    p_note TEXT
) RETURNS void AS $$
DECLARE
    v_caller_workspace UUID;
BEGIN
    v_caller_workspace := ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid;

    IF v_caller_workspace IS NULL OR v_caller_workspace <> p_workspace_id THEN
        RAISE EXCEPTION 'Not authorized to record usage for this workspace.';
    END IF;

    INSERT INTO public.workspace_usage_ledger (workspace_id, usage_type, units, source_id, note)
    VALUES (p_workspace_id, p_usage_type, GREATEST(1, p_units), p_source_id, p_note);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.get_workspace_entitlement(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_entitlement(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_workspace_entitlement(UUID) FROM anon;

REVOKE ALL ON FUNCTION public.record_workspace_usage(UUID, VARCHAR, INT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_workspace_usage(UUID, VARCHAR, INT, UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_workspace_usage(UUID, VARCHAR, INT, UUID, TEXT) FROM anon;
