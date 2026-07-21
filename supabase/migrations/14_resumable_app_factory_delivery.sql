-- Production hardening for resumable App Factory runs and structured delivery.
ALTER TABLE public.build_tasks
    ADD COLUMN IF NOT EXISTS task_key VARCHAR(80),
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_error TEXT,
    ADD COLUMN IF NOT EXISTS result_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.build_tasks
    DROP CONSTRAINT IF EXISTS build_tasks_attempt_count_nonnegative;

ALTER TABLE public.build_tasks
    ADD CONSTRAINT build_tasks_attempt_count_nonnegative CHECK (attempt_count >= 0);

CREATE INDEX IF NOT EXISTS idx_build_tasks_run_task_key
    ON public.build_tasks(run_id, task_key);

-- Claiming is atomic and records enough state to diagnose or recover an interrupted call.
CREATE OR REPLACE FUNCTION public.claim_app_factory_task(
    p_workspace_id UUID,
    p_run_id UUID,
    p_task_id UUID
)
RETURNS SETOF public.build_tasks
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
    UPDATE public.build_tasks
    SET
        status = 'running',
        output_logs = 'Agent action in progress.',
        started_at = timezone('utc', now()),
        completed_at = NULL,
        last_error = NULL,
        attempt_count = attempt_count + 1
    WHERE id = p_task_id
      AND workspace_id = p_workspace_id
      AND run_id = p_run_id
      AND status = 'pending'
    RETURNING *;
$$;

-- A terminated server request must not leave a run permanently stuck in "running".
CREATE OR REPLACE FUNCTION public.recover_stale_app_factory_tasks(
    p_workspace_id UUID,
    p_run_id UUID,
    p_stale_before TIMESTAMPTZ DEFAULT timezone('utc', now()) - interval '15 minutes'
)
RETURNS SETOF public.build_tasks
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
    UPDATE public.build_tasks
    SET
        status = 'pending',
        last_error = 'The previous agent request was interrupted and was returned to the queue.',
        output_logs = 'Recovered an interrupted agent request. Ready to retry.'
    WHERE workspace_id = p_workspace_id
      AND run_id = p_run_id
      AND status = 'running'
      AND started_at IS NOT NULL
      AND started_at < p_stale_before
    RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.claim_app_factory_task(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_app_factory_task(UUID, UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.recover_stale_app_factory_tasks(UUID, UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recover_stale_app_factory_tasks(UUID, UUID, TIMESTAMPTZ) TO authenticated;
