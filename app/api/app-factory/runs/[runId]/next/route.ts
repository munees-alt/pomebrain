import { NextResponse } from "next/server";
import { executeNextAppFactoryTask } from "@/lib/app-factory/execute-next.server";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase-server";

export const maxDuration = 300;

export async function POST(_request: Request, context: { params: Promise<{ runId: string }> }) {
  if (!hasSupabaseServerEnv()) return NextResponse.json({ error: "The workspace service is unavailable." }, { status: 503 });
  try {
    const { runId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Sign in before running agents." }, { status: 401 });
    const workspaceId = user.app_metadata?.workspace_id;
    if (typeof workspaceId !== "string") return NextResponse.json({ error: "Your account is missing its workspace." }, { status: 400 });

    const result = await executeNextAppFactoryTask({ supabase: supabase as never, authenticatedUserId: user.id, workspaceId, runId });
    return NextResponse.json(result, { status: result.status === "approval_required" ? 202 : 200 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to run the next agent task.";
    const paymentRequired = /agent access is paused|used all agent actions/i.test(message);
    return NextResponse.json({ error: message }, { status: paymentRequired ? 402 : 400 });
  }
}
