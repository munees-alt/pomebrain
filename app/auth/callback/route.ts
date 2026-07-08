import { NextResponse } from "next/server";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") ? next : "/";

  if (!hasSupabaseServerEnv()) {
    return NextResponse.redirect(new URL("/login?error=missing_supabase_env", requestUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_oauth_code", requestUrl.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "oauth_exchange_failed");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
}
