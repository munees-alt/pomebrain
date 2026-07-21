import "server-only";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type ModelKeyProvider = "claude" | "openai" | "gemini";

// Fetches a workspace's own model provider key from Supabase Vault, decrypted
// via the service-role-only get_workspace_model_key RPC. Returns null if the
// workspace never configured one. Customer execution must stop in that case;
// Pomebrain never spends or exposes a shared platform model key for a tenant.
export async function getWorkspaceModelKey(workspaceId: string, provider: ModelKeyProvider): Promise<string | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_workspace_model_key`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_workspace_id: workspaceId, p_provider: provider }),
  });

  if (!response.ok) return null;

  const text = await response.text();
  if (!text || text === "null") return null;

  try {
    const value = JSON.parse(text);
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}
