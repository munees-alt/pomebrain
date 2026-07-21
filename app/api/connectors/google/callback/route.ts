import { NextResponse } from "next/server";
import { exchangeGoogleCodeForTokens, fetchGoogleUserInfo } from "@/lib/oauth/google-workspace.server";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const expectedState = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("pomebrain_google_oauth_state="))
    ?.split("=")[1];

  const redirectUrl = new URL("/", origin);
  redirectUrl.searchParams.set("connector", "google_workspace");

  if (!hasSupabaseServerEnv()) {
    redirectUrl.searchParams.set("connector_error", "supabase_not_configured");
    return NextResponse.redirect(redirectUrl);
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    redirectUrl.searchParams.set("connector_error", "invalid_google_state");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) {
      return NextResponse.redirect(new URL("/login", origin));
    }

    const workspaceId = user.app_metadata?.workspace_id;
    if (typeof workspaceId !== "string") {
      throw new Error("Your account is missing workspace_id metadata.");
    }

    const token = await exchangeGoogleCodeForTokens(code);
    const userInfo = await fetchGoogleUserInfo(token.access_token);
    const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;
    const scopes = (token.scope ? token.scope.split(" ") : []).filter(Boolean);

    const { error: rpcError } = await supabase.rpc("set_workspace_oauth_connection", {
      p_workspace_id: workspaceId,
      p_provider: "google_workspace",
      p_refresh_token: token.refresh_token ?? null,
      p_account_email: userInfo.email ?? user.email ?? null,
      p_scopes: scopes,
      p_access_token_expires_at: expiresAt,
    });

    if (rpcError) throw rpcError;

    redirectUrl.searchParams.set("connector_status", "google_connected");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("pomebrain_google_oauth_state");
    return response;
  } catch (error) {
    redirectUrl.searchParams.set(
      "connector_error",
      error instanceof Error ? error.message.slice(0, 140) : "google_callback_failed",
    );
    return NextResponse.redirect(redirectUrl);
  }
}
