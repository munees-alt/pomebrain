import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "healthy",
    phase: 0,
    service: "pomebrain",
    environment: {
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      openai: Boolean(process.env.OPENAI_API_KEY),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      github: Boolean(process.env.POMEBRAIN_GITHUB_PAT || process.env.GITHUB_PERSONAL_ACCESS_TOKEN),
      vercel: Boolean(process.env.POMEBRAIN_VERCEL_TOKEN || process.env.VERCEL_TOKEN),
      google: Boolean(process.env.POMEBRAIN_GOOGLE_CLIENT_ID && process.env.POMEBRAIN_GOOGLE_CLIENT_SECRET),
      fathom: Boolean(process.env.POMEBRAIN_FATHOM_API_TOKEN || process.env.FATHOM_API_TOKEN),
    },
  });
}
