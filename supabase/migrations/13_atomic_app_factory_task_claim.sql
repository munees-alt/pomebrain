-- Atomically moves one known App Factory task from pending to running.
-- RLS remains authoritative because this function uses the caller's privileges.
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
    SET status = 'running', output_logs = 'Agent action in progress.'
    WHERE id = p_task_id
      AND workspace_id = p_workspace_id
      AND run_id = p_run_id
      AND status = 'pending'
    RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.claim_app_factory_task(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_app_factory_task(UUID, UUID, UUID) TO authenticated;
