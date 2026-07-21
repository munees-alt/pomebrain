-- Production billing: Stripe subscription sync and enforceable monthly plan limits.

ALTER TABLE public.workspace_subscriptions
    ADD COLUMN IF NOT EXISTS external_price_id TEXT,
    ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.get_workspace_entitlement_v2(p_workspace_id UUID)
RETURNS TABLE (
    plan_slug TEXT,
    status TEXT,
    trial_ends_at TIMESTAMPTZ,
    days_remaining INT,
    can_build BOOLEAN,
    reason TEXT,
    monthly_build_limit INT,
    monthly_agent_execution_limit INT,
    builds_used INT,
    agent_executions_used INT,
    current_period_ends_at TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN,
    has_billing_account BOOLEAN
) AS $$
DECLARE
    v_caller_workspace UUID;
    v_workspace_created_at TIMESTAMPTZ;
    v_subscription public.workspace_subscriptions%ROWTYPE;
    v_trial_ends_at TIMESTAMPTZ;
    v_period_start TIMESTAMPTZ;
    v_builds_used INT;
    v_agent_executions_used INT;
    v_can_build BOOLEAN;
BEGIN
    v_caller_workspace := ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid;
    IF v_caller_workspace IS NULL OR v_caller_workspace <> p_workspace_id THEN
        RAISE EXCEPTION 'Not authorized to view entitlement for this workspace.';
    END IF;

    SELECT created_at INTO v_workspace_created_at FROM public.workspaces WHERE id = p_workspace_id;
    IF v_workspace_created_at IS NULL THEN RAISE EXCEPTION 'Workspace not found.'; END IF;

    SELECT * INTO v_subscription FROM public.workspace_subscriptions WHERE workspace_id = p_workspace_id;

    IF v_subscription.id IS NOT NULL AND v_subscription.status IN ('active', 'admin_grant') THEN
        v_period_start := COALESCE(v_subscription.current_period_started_at, date_trunc('month', timezone('utc', now())));
        SELECT COALESCE(SUM(units), 0)::INT INTO v_builds_used
          FROM public.workspace_usage_ledger
         WHERE workspace_id = p_workspace_id AND usage_type = 'crown_run' AND created_at >= v_period_start;
        SELECT COALESCE(SUM(units), 0)::INT INTO v_agent_executions_used
          FROM public.workspace_usage_ledger
         WHERE workspace_id = p_workspace_id AND usage_type = 'agent_execution' AND created_at >= v_period_start;

        v_can_build := v_subscription.monthly_agent_execution_limit IS NULL
            OR v_agent_executions_used < v_subscription.monthly_agent_execution_limit;
        RETURN QUERY SELECT
            v_subscription.plan_slug::TEXT,
            v_subscription.status::TEXT,
            v_subscription.trial_ends_at,
            NULL::INT,
            v_can_build,
            CASE WHEN v_can_build THEN 'paid_or_admin_entitlement' ELSE 'monthly_agent_action_limit_reached' END::TEXT,
            v_subscription.monthly_build_limit,
            v_subscription.monthly_agent_execution_limit,
            v_builds_used,
            v_agent_executions_used,
            v_subscription.current_period_ends_at,
            v_subscription.cancel_at_period_end,
            v_subscription.external_customer_id IS NOT NULL;
        RETURN;
    END IF;

    v_trial_ends_at := COALESCE(v_subscription.trial_ends_at, v_workspace_created_at + interval '1 month');
    SELECT COALESCE(SUM(units), 0)::INT INTO v_builds_used
      FROM public.workspace_usage_ledger
     WHERE workspace_id = p_workspace_id AND usage_type = 'crown_run' AND created_at >= v_workspace_created_at;
    SELECT COALESCE(SUM(units), 0)::INT INTO v_agent_executions_used
      FROM public.workspace_usage_ledger
     WHERE workspace_id = p_workspace_id AND usage_type = 'agent_execution' AND created_at >= v_workspace_created_at;

    v_can_build := timezone('utc', now()) <= v_trial_ends_at AND v_agent_executions_used < 200;

    RETURN QUERY SELECT
        COALESCE(v_subscription.plan_slug, 'free_trial')::TEXT,
        CASE WHEN timezone('utc', now()) <= v_trial_ends_at THEN 'trialing' ELSE 'trial_expired' END::TEXT,
        v_trial_ends_at,
        GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_trial_ends_at - timezone('utc', now()))) / 86400)::INT),
        v_can_build,
        CASE
            WHEN timezone('utc', now()) > v_trial_ends_at THEN 'trial_expired_paid_plan_required'
            WHEN v_agent_executions_used >= 200 THEN 'trial_agent_action_limit_reached'
            ELSE 'free_trial_active'
        END::TEXT,
        NULL::INT,
        200,
        v_builds_used,
        v_agent_executions_used,
        NULL::TIMESTAMPTZ,
        FALSE,
        v_subscription.external_customer_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.get_workspace_entitlement_v2(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_entitlement_v2(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_workspace_entitlement_v2(UUID) FROM anon;
