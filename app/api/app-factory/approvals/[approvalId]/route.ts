import { NextResponse } from "next/server";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase-server";

export async function POST(request: Request, context: { params: Promise<{ approvalId: string }> }) {
  if (!hasSupabaseServerEnv()) return NextResponse.json({ error: "The workspace service is unavailable." }, { status: 503 });
  try {
    const { approvalId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { decision?: unknown };
    if (body.decision !== "approved" && body.decision !== "rejected") {
      return NextResponse.json({ error: "Choose approved or rejected." }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Sign in before reviewing an approval." }, { status: 401 });
    const workspaceId = user.app_metadata?.workspace_id;
    if (typeof workspaceId !== "string") return NextResponse.json({ error: "Your account is missing its workspace." }, { status: 400 });

    const { data: approval, error: approvalError } = await supabase
      .from("approval_queue")
      .update({ status: body.decision, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("id", approvalId)
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .select("id,run_id,status")
      .maybeSingle();
    if (approvalError) throw approvalError;
    if (!approval) return NextResponse.json({ error: "Pending approval not found." }, { status: 404 });
    if (body.decision === "rejected") {
      await supabase.from("project_runs").update({ status: "failed" }).eq("id", approval.run_id);
    } else {
      await supabase.from("project_runs").update({ status: "processing" }).eq("id", approval.run_id);
    }
    return NextResponse.json({ approval });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Unable to review approval." }, { status: 400 });
  }
}
