import { NextResponse } from "next/server";
import { executeGovernedCapability } from "@/lib/mcp/executor.server";

export async function POST(request: Request) {
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

