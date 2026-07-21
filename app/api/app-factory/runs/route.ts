import { NextResponse } from "next/server";
import { createPersistedAppFactoryRun, type SupabaseAppFactoryClient } from "@/lib/app-factory/create-run.server";
import { createCrownPlan } from "@/lib/crown-planner";
import { CrownRunSchema } from "@/lib/domain";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase-server";
import { verifyBuildPreflight } from "@/lib/app-factory/preflight.server";

export async function GET() {
  if (!hasSupabaseServerEnv()) return NextResponse.json({ error: "The workspace service is unavailable." }, { status: 503 });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Sign in to resume an App Factory run." }, { status: 401 });
    const workspaceId = user.app_metadata?.workspace_id;
    if (typeof workspaceId !== "string") return NextResponse.json({ error: "Your account is missing its workspace." }, { status: 400 });

    const { data: activeRun, error: runError } = await supabase
      .from("project_runs")
      .select("id,project_id,status,execution_context,created_at")
      .eq("workspace_id", workspaceId)
      .in("status", ["processing", "blocked_by_approval"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (runError) throw runError;
    if (!activeRun) return NextResponse.json({ active: null });

    const [projectResult, tasksResult, approvalsResult] = await Promise.all([
      supabase.from("projects").select("id").eq("id", activeRun.project_id).eq("workspace_id", workspaceId).maybeSingle(),
      supabase.from("build_tasks").select("id", { count: "exact", head: true }).eq("run_id", activeRun.id).eq("workspace_id", workspaceId),
      supabase.from("approval_queue").select("id", { count: "exact", head: true }).eq("run_id", activeRun.id).eq("workspace_id", workspaceId).eq("status", "pending"),
    ]);
    if (projectResult.error) throw projectResult.error;
    if (tasksResult.error) throw tasksResult.error;
    if (approvalsResult.error) throw approvalsResult.error;

    const context = activeRun.execution_context as Record<string, unknown> | null;
    const plan = CrownRunSchema.safeParse(context?.plan);
    if (!projectResult.data || !plan.success) return NextResponse.json({ active: null });

    return NextResponse.json({
      active: {
        run: plan.data,
        persisted: {
          projectId: projectResult.data.id,
          runId: activeRun.id,
          status: activeRun.status,
          taskCount: tasksResult.count ?? plan.data.steps.length,
          approvalCount: approvalsResult.count ?? 0,
        },
      },
    });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Unable to resume the active build." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  try {
    const body = (await request.json()) as { goal?: unknown };
    const run = createCrownPlan(typeof body.goal === "string" ? body.goal : "");
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Sign in before starting an App Factory run." }, { status: 401 });
    }

    const workspaceId = user.app_metadata?.workspace_id;
    if (typeof workspaceId !== "string") {
      return NextResponse.json({ error: "Your account is missing workspace_id metadata." }, { status: 400 });
    }

    const { data: entitlementRows, error: entitlementError } = await supabase.rpc("get_workspace_entitlement_v2", {
      p_workspace_id: workspaceId,
    });
    if (entitlementError) throw entitlementError;

    const entitlement = entitlementRows?.[0] as { can_build?: boolean; status?: string; days_remaining?: number | null; reason?: string } | undefined;
    if (!entitlement?.can_build) {
      return NextResponse.json(
        {
          error: entitlement?.reason === "monthly_agent_action_limit_reached" || entitlement?.reason === "trial_agent_action_limit_reached"
            ? "This workspace has used all agent actions included in its current access period. Upgrade or wait for the next billing period."
            : "Your free agent-build month has ended. Choose a monthly plan to keep using protected agents.",
          entitlement,
        },
        { status: 402 },
      );
    }

    const preflight = await verifyBuildPreflight(workspaceId, run);
    const blocked = preflight.filter((item) => !item.ready);
    if (blocked.length) {
      return NextResponse.json({
        error: `Complete the build connections first: ${blocked.map((item) => item.message).join(" ")}`,
        preflight,
      }, { status: 409 });
    }

    const persisted = await createPersistedAppFactoryRun({
      supabase: supabase as unknown as SupabaseAppFactoryClient,
      workspaceId,
      approvedByUserId: user.id,
      run,
    });

    await supabase.rpc("record_workspace_usage", {
      p_workspace_id: workspaceId,
      p_usage_type: "crown_run",
      p_units: 1,
      p_source_id: persisted.runId,
      p_note: "Crown App Factory run created.",
    });

    return NextResponse.json({ run, persisted, entitlement }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create App Factory run." },
      { status: 400 },
    );
  }
}
