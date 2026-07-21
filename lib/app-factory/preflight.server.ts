import "server-only";

import type { CrownRun } from "@/lib/domain";
import { getWorkspaceModelKey, type ModelKeyProvider } from "@/lib/secrets/workspace-model-keys.server";
import { verifyWorkspaceGitHubConnection } from "@/lib/mcp/connectors/github.server";
import { verifyWorkspaceVercelConnection } from "@/lib/mcp/connectors/vercel.server";
import { verifyWorkspaceSupabaseConnection } from "@/lib/mcp/connectors/supabase.server";

export type BuildProvider = "model" | "github" | "vercel" | "supabase";
export type PreflightResult = { provider: BuildProvider; ready: boolean; message: string; details?: unknown };

export function requiredBuildProviders(run: CrownRun): BuildProvider[] {
  const requirements = new Set(run.connectorPlan.map((item) => item.requirement));
  const providers: BuildProvider[] = ["model", "github"];
  if (requirements.has("app_hosting")) providers.push("vercel");
  if (requirements.has("backend_database") || requirements.has("auth") || requirements.has("file_storage")) providers.push("supabase");
  return providers;
}

async function verifyModel(workspaceId: string) {
  const candidates: ModelKeyProvider[] = ["openai", "claude"];
  const keys = await Promise.all(candidates.map(async (provider) => ({ provider, key: await getWorkspaceModelKey(workspaceId, provider) })));
  const configured = keys.find((item) => item.key);
  if (!configured?.key) throw new Error("Connect an OpenAI or Anthropic API key before running agents.");

  const response = configured.provider === "openai"
    ? await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${configured.key}` } })
    : await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": configured.key, "anthropic-version": "2023-06-01" } });
  if (!response.ok) throw new Error(`${configured.provider === "openai" ? "OpenAI" : "Anthropic"} rejected the connected API key (${response.status}).`);
  return { provider: configured.provider };
}

export async function verifyBuildPreflight(workspaceId: string, run: CrownRun): Promise<PreflightResult[]> {
  const verifiers: Record<BuildProvider, () => Promise<unknown>> = {
    model: () => verifyModel(workspaceId),
    github: () => verifyWorkspaceGitHubConnection(workspaceId),
    vercel: () => verifyWorkspaceVercelConnection(workspaceId),
    supabase: () => verifyWorkspaceSupabaseConnection(workspaceId),
  };

  return Promise.all(requiredBuildProviders(run).map(async (provider) => {
    try {
      const details = await verifiers[provider]();
      return { provider, ready: true, message: "Verified", details };
    } catch (cause) {
      return { provider, ready: false, message: cause instanceof Error ? cause.message : "Connection verification failed." };
    }
  }));
}
