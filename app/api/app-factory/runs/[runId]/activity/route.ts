import { NextResponse } from "next/server";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase-server";

const ACTIVITY_LIMIT = 60;

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  if (!hasSupabaseServerEnv()) return NextResponse.json({ error: "The workspace service is unavailable." }, { status: 503 });

  try {
    const { runId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Sign in to view run activity." }, { status: 401 });

    const workspaceId = user.app_metadata?.workspace_id;
    if (typeof workspaceId !== "string") return NextResponse.json({ error: "Your account is missing its workspace." }, { status: 400 });

    const { data: run, error: runError } = await supabase
      .from("project_runs")
      .select("id")
      .eq("id", runId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (runError) throw runError;
    if (!run) return NextResponse.json({ error: "Build run not found in this workspace." }, { status: 404 });

    const { data: tasks, error: taskError } = await supabase
      .from("build_tasks")
      .select("id")
      .eq("run_id", runId)
      .eq("workspace_id", workspaceId);
    if (taskError) throw taskError;

    const targetIds = [runId, ...(tasks ?? []).map((task) => task.id)];
    const { data: events, error: eventError } = await supabase
      .from("audit_events")
      .select("id,action_type,target_table,target_id,state_after,created_at")
      .eq("workspace_id", workspaceId)
      .in("target_id", targetIds)
      .order("created_at", { ascending: false })
      .limit(ACTIVITY_LIMIT);
    if (eventError) throw eventError;

    return NextResponse.json({ events: events ?? [], cappedAt: ACTIVITY_LIMIT });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Unable to load run activity." }, { status: 400 });
  }
}
