import { NextResponse } from "next/server";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase-server";

export type WorkspaceEntitlement = {
  plan_slug: string;
  status: string;
  trial_ends_at: string | null;
  days_remaining: number | null;
  can_build: boolean;
  reason: string;
  monthly_build_limit: number | null;
  monthly_agent_execution_limit: number | null;
  builds_used: number;
  agent_executions_used: number;
  current_period_ends_at: string | null;
  cancel_at_period_end: boolean;
  has_billing_account: boolean;
};

export async function GET() {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Sign in to view your entitlement." }, { status: 401 });
    }

    const workspaceId = user.app_metadata?.workspace_id;
    if (typeof workspaceId !== "string") {
      return NextResponse.json({ error: "Your account is missing workspace_id metadata." }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("get_workspace_entitlement_v2", { p_workspace_id: workspaceId });
    if (error) throw error;

    return NextResponse.json({ entitlement: (data?.[0] ?? null) as WorkspaceEntitlement | null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load billing entitlement." },
      { status: 400 },
    );
  }
}
