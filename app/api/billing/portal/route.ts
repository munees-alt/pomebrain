import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripe.server";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase-server";

export async function POST(request: Request) {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ error: "The workspace service is unavailable." }, { status: 503 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Sign in to manage billing." }, { status: 401 });

    const workspaceId = user.app_metadata?.workspace_id;
    if (typeof workspaceId !== "string") {
      return NextResponse.json({ error: "Your account is missing its workspace." }, { status: 400 });
    }

    const { data: subscription, error } = await supabase
      .from("workspace_subscriptions")
      .select("external_customer_id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw error;
    if (!subscription?.external_customer_id) {
      return NextResponse.json({ error: "Choose a paid plan before opening billing management." }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.external_customer_id,
      return_url: `${origin}/?billing=portal_return`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to open billing management." },
      { status: 500 },
    );
  }
}
