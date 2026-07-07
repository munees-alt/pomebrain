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
    },
  });
}

