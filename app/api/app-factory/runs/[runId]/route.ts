import { NextResponse } from "next/server";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase-server";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  if (!hasSupabaseServerEnv()) return NextResponse.json({ error: "The workspace service is unavailable." }, { status: 503 });

  try {
    const { runId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Sign in to view this build." }, { status: 401 });
    const workspaceId = user.app_metadata?.workspace_id;
    if (typeof workspaceId !== "string") return NextResponse.json({ error: "Your account is missing its workspace." }, { status: 400 });

    const { data: run, error: runError } = await supabase
      .from("project_runs")
      .select("id,project_id,status,created_at,updated_at")
      .eq("id", runId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (runError) throw runError;
    if (!run) return NextResponse.json({ error: "Build run not found in this workspace." }, { status: 404 });

    const [tasksResult, approvalsResult] = await Promise.all([
      supabase
        .from("build_tasks")
        .select("id,task_key,title,status,sequence_order,attempt_count,last_error,output_logs,result_payload,started_at,completed_at")
        .eq("run_id", runId)
        .eq("workspace_id", workspaceId)
        .order("sequence_order", { ascending: true }),
      supabase
        .from("approval_queue")
        .select("id,task_id,requested_capability,risk_level,status,created_at,reviewed_at")
        .eq("run_id", runId)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
    ]);
    if (tasksResult.error) throw tasksResult.error;
    if (approvalsResult.error) throw approvalsResult.error;

    const tasks = tasksResult.data ?? [];
    const approvals = approvalsResult.data ?? [];
    const currentTask = tasks.find((task) => task.status === "pending" || task.status === "running") ?? null;
    const pendingApproval = currentTask
      ? approvals.find((approval) => approval.task_id === currentTask.id && approval.status === "pending") ?? null
      : null;
    const deliverables = tasks
      .map((task) => task.result_payload as Record<string, unknown> | null)
      .filter((payload): payload is Record<string, unknown> => Boolean(payload && Object.keys(payload).length));

    const runnerState = run.status === "success"
      ? { status: "complete" as const }
      : run.status === "failed"
        ? { status: "failed" as const }
        : pendingApproval
          ? {
              status: "approval_required" as const,
              taskTitle: currentTask?.title,
              approval: {
                id: pendingApproval.id,
                requested_capability: pendingApproval.requested_capability,
                risk_level: pendingApproval.risk_level,
              },
            }
          : currentTask?.status === "running"
            ? { status: "processing" as const, taskTitle: currentTask.title }
            : { status: "idle" as const, taskTitle: currentTask?.title };

    return NextResponse.json({ run, tasks, approvals, deliverables, runnerState });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Unable to load the build state." }, { status: 400 });
  }
}
