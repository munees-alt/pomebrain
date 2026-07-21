import "server-only";

import type { CapabilityRequest } from "@/lib/mcp/capabilities";
import { getWorkspaceConnectorConfig } from "@/lib/secrets/workspace-connector.server";

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

async function fetchCustomerOpenApiDefinitions(request: CapabilityRequest) {
  const connector = await getWorkspaceConnectorConfig(request.metadata.workspaceId ?? "", "supabase", "service_role_key");
  const projectUrl = typeof connector?.metadata.project_url === "string" ? connector.metadata.project_url.replace(/\/$/, "") : null;
  if (!connector || !projectUrl) {
    throw new Error("Connect your Supabase project URL and service-role key before agents inspect its database.");
  }

  const response = await fetch(`${projectUrl}/rest/v1/`, {
    headers: {
      apikey: connector.secret,
      Authorization: `Bearer ${connector.secret}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) throw new Error(`Your Supabase schema could not be read (${response.status}).`);
  const spec = await response.json();
  return (spec?.definitions ?? {}) as Record<string, unknown>;
}

async function handleDatabaseRead(request: Extract<CapabilityRequest, { capabilityId: "supabase.database.read" }>) {
  const definitions = await fetchCustomerOpenApiDefinitions(request);

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

  const workspaceId = request.metadata.workspaceId;
  if (!workspaceId) throw new Error("A workspace is required for task-state updates.");
  const rows = await restRequest(`build_tasks?id=eq.${taskId}&workspace_id=eq.${workspaceId}`, {
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

export async function verifyWorkspaceSupabaseConnection(workspaceId: string) {
  const connector = await getWorkspaceConnectorConfig(workspaceId, "supabase", "service_role_key");
  if (!connector) throw new Error("Connect your Supabase project before agents use its backend.");
  const projectUrl = typeof connector.metadata.project_url === "string" ? connector.metadata.project_url.replace(/\/$/, "") : "";
  if (!projectUrl) throw new Error("Add the Supabase project URL in Connectors.");
  const response = await fetch(`${projectUrl}/rest/v1/`, {
    headers: { apikey: connector.secret, Authorization: `Bearer ${connector.secret}` },
  });
  if (!response.ok) throw new Error(`Supabase credential verification failed (${response.status}).`);
  return { provider: "supabase" as const, projectUrl };
}
