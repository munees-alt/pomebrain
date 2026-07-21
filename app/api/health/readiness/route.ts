import { NextResponse } from "next/server";
import { hasStripeEnv } from "@/lib/billing/stripe.server";
import { hasGoogleConnectorEnv } from "@/lib/oauth/google-workspace.server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin.server";

type ReadinessCheck = { ready: boolean; message: string };

async function databaseCheck(): Promise<ReadinessCheck> {
  try {
    const { error } = await createSupabaseAdminClient().from("build_tasks").select("task_key,result_payload").limit(1);
    if (error) throw error;
    return { ready: true, message: "App Factory delivery schema is reachable." };
  } catch (cause) {
    return { ready: false, message: cause instanceof Error ? cause.message : "Database readiness check failed." };
  }
}

export async function GET() {
  const checks: Record<string, ReadinessCheck> = {
    database: await databaseCheck(),
    googleOAuth: {
      ready: hasGoogleConnectorEnv(),
      message: hasGoogleConnectorEnv() ? "Google OAuth is configured." : "Google OAuth environment is incomplete.",
    },
    billing: {
      ready: hasStripeEnv(),
      message: hasStripeEnv() ? "Stripe billing is configured." : "Stripe secret and webhook credentials are missing.",
    },
    canonicalUrl: {
      ready: Boolean(process.env.NEXT_PUBLIC_APP_URL),
      message: process.env.NEXT_PUBLIC_APP_URL ? "Canonical application URL is configured." : "NEXT_PUBLIC_APP_URL is missing.",
    },
  };
  const ready = Object.values(checks).every((check) => check.ready);
  return NextResponse.json({ status: ready ? "ready" : "degraded", service: "pomebrain", checks }, { status: ready ? 200 : 503 });
}
