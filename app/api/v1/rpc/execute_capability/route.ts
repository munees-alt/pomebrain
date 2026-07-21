import { NextResponse } from "next/server";
import { executeGovernedCapability } from "@/lib/mcp/executor.server";
import { isPlatformAdmin } from "@/lib/admin";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase-server";

export async function POST(request: Request) {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ status: "rejected", message: "The workspace service is unavailable." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ status: "rejected", message: "Authentication is required." }, { status: 401 });
  }
  if (!isPlatformAdmin(user.email, user.app_metadata)) {
    return NextResponse.json({ status: "rejected", message: "Direct capability execution is restricted to the master-admin control plane." }, { status: 403 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        status: "rejected",
        message: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  const result = await executeGovernedCapability(body);

  if (result.status === "rejected") {
    return NextResponse.json(result, { status: 400 });
  }

  if (result.status === "requires_approval") {
    return NextResponse.json(result, { status: 202 });
  }

  return NextResponse.json(result, { status: 200 });
}
