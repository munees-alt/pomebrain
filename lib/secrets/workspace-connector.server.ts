import "server-only";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type WorkspaceConnectorConfig = {
  secret: string;
  accountLabel: string | null;
  metadata: Record<string, unknown>;
};

export async function getWorkspaceConnectorConfig(
  workspaceId: string,
  provider: string,
  credentialKind: string,
): Promise<WorkspaceConnectorConfig | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;

  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
  const query = new URLSearchParams({
    select: "account_label,metadata",
    workspace_id: `eq.${workspaceId}`,
    provider: `eq.${provider}`,
    credential_kind: `eq.${credentialKind}`,
    limit: "1",
  });

  const [metadataResponse, secretResponse] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/workspace_connector_secrets?${query}`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/rpc/get_workspace_connector_secret`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_workspace_id: workspaceId,
        p_provider: provider,
        p_credential_kind: credentialKind,
      }),
    }),
  ]);

  if (!metadataResponse.ok || !secretResponse.ok) return null;
  const rows = (await metadataResponse.json()) as Array<{ account_label?: string | null; metadata?: Record<string, unknown> }>;
  const secret = (await secretResponse.json()) as unknown;
  if (!rows[0] || typeof secret !== "string" || !secret) return null;

  return {
    secret,
    accountLabel: rows[0].account_label ?? null,
    metadata: rows[0].metadata ?? {},
  };
}
