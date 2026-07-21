import { NextResponse } from "next/server";
import { hasGoogleConnectorEnv } from "@/lib/oauth/google-workspace.server";
import { hasStripeEnv } from "@/lib/billing/stripe.server";

export function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "pomebrain",
    release: "production",
    environment: {
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      google: hasGoogleConnectorEnv(),
      billing: hasStripeEnv(),
      customerCredentials: "workspace_owned_only",
    },
  });
}
