import { NextResponse } from "next/server";
import { createGoogleAuthorizationUrl, createGoogleOAuthState, hasGoogleConnectorEnv } from "@/lib/oauth/google-workspace.server";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  if (!hasSupabaseServerEnv()) {
    return NextResponse.redirect(new URL("/?connector_error=supabase_not_configured", origin));
  }

  if (!hasGoogleConnectorEnv()) {
    return NextResponse.redirect(new URL("/?connector_error=google_env_missing", origin));
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const state = createGoogleOAuthState();
  const response = NextResponse.redirect(createGoogleAuthorizationUrl({ state }));
  response.cookies.set("pomebrain_google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}
