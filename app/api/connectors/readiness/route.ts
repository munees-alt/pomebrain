import { NextResponse } from "next/server";
import { createCrownPlan } from "@/lib/crown-planner";
import { verifyBuildPreflight } from "@/lib/app-factory/preflight.server";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase-server";

export async function POST(request: Request) {
  if (!hasSupabaseServerEnv()) return NextResponse.json({ error: "The workspace service is unavailable." }, { status: 503 });
  try {
    const body = (await request.json().catch(() => ({}))) as { goal?: unknown };
    const goal = typeof body.goal === "string" && body.goal.trim().length >= 12
      ? body.goal
      : "Build and deploy a secure web application with authentication and a database";
    const run = createCrownPlan(goal);
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Sign in to verify build connections." }, { status: 401 });
    const workspaceId = user.app_metadata?.workspace_id;
    if (typeof workspaceId !== "string") return NextResponse.json({ error: "Your account is missing its workspace." }, { status: 400 });
    const results = await verifyBuildPreflight(workspaceId, run);
    return NextResponse.json({ ready: results.every((item) => item.ready), results });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Unable to verify build connections." }, { status: 400 });
  }
}
