import "server-only";

import type { CapabilityRequest } from "@/lib/mcp/capabilities";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertConfigured() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase connector is not configured: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
}

async function restRequest(pathAndQuery: string, init: RequestInit = {}) {
  assertConfigured();

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY as string,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase REST ${init.method ?? "GET"} ${pathAndQuery} failed (${response.status}): ${body}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function fetchOpenApiDefinitions() {
  const spec = await restRequest("");
  return (spec?.definitions ?? {}) as Record<string, unknown>;
}

async function handleDatabaseRead(request: Extract<CapabilityRequest, { capabilityId: "supabase.database.read" }>) {
  const definitions = await fetchOpenApiDefinitions();

  if (request.payload.action === "list_tables") {
    return { tables: Object.keys(definitions).sort() };
  }

  const tableName = request.payload.tableName as string;
  const schema = definitions[tableName];
  if (!schema) {
    throw new Error(`Table "${tableName}" was not found in the public schema.`);
  }
  return { table: tableName, schema };
}

async function handleTaskStateWrite(request: Extract<CapabilityRequest, { capabilityId: "supabase.task_state.write" }>) {
  const { taskId, nextStatus, statusReason } = request.payload;

  const rows = await restRequest(`build_tasks?id=eq.${taskId}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: nextStatus, output_logs: statusReason }),
  });

  if (!rows?.length) {
    throw new Error(`build_tasks row "${taskId}" was not found; nothing was updated.`);
  }

  return { updated: rows[0] };
}

export async function executeSupabaseCapability(request: CapabilityRequest) {
  switch (request.capabilityId) {
    case "supabase.database.read":
      return handleDatabaseRead(request);
    case "supabase.task_state.write":
      return handleTaskStateWrite(request);
    default:
      throw new Error(`Supabase connector cannot handle capability "${request.capabilityId}".`);
  }
}
