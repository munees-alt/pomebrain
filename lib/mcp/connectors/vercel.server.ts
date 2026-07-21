import "server-only";

import type { CapabilityRequest } from "@/lib/mcp/capabilities";
import { getWorkspaceConnectorConfig, type WorkspaceConnectorConfig } from "@/lib/secrets/workspace-connector.server";

const VERCEL_API = "https://api.vercel.com";

function withTeam(path: string, connector: WorkspaceConnectorConfig) {
  const teamId = typeof connector.metadata.team_id === "string" ? connector.metadata.team_id : "";
  if (!teamId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(teamId)}`;
}

async function vercelRequest(connector: WorkspaceConnectorConfig, path: string, init: RequestInit = {}) {
  const response = await fetch(`${VERCEL_API}${withTeam(path, connector)}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${connector.secret}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`Vercel ${init.method ?? "GET"} ${path} failed (${response.status}): ${body?.error?.message ?? text}`);
  }

  return body;
}

async function handlePreviewDeploy(request: Extract<CapabilityRequest, { capabilityId: "vercel.deploy.preview" }>) {
  const { projectId, branch } = request.payload;
  const connector = await getWorkspaceConnectorConfig(request.metadata.workspaceId ?? "", "vercel", "access_token");
  if (!connector) throw new Error("Connect your Vercel access token before agents deploy.");
  const gitOrg = typeof connector.metadata.git_org === "string" ? connector.metadata.git_org : null;
  const gitRepo = typeof connector.metadata.git_repo === "string" ? connector.metadata.git_repo : null;
  if (!gitOrg || !gitRepo) throw new Error("Add the GitHub organization and repository to your Vercel connector settings.");

  const deployment = await vercelRequest(connector, "/v13/deployments", {
    method: "POST",
    body: JSON.stringify({
      name: projectId,
      project: projectId,
      target: "preview",
      gitSource: { type: "github", ref: branch, org: gitOrg, repo: gitRepo },
    }),
  });

  return { id: deployment.id, url: deployment.url, readyState: deployment.readyState };
}

async function handleProductionPromote(request: Extract<CapabilityRequest, { capabilityId: "vercel.deploy.production" }>) {
  const { projectId, deploymentUrl } = request.payload;
  const connector = await getWorkspaceConnectorConfig(request.metadata.workspaceId ?? "", "vercel", "access_token");
  if (!connector) throw new Error("Connect your Vercel access token before agents deploy.");

  const lookup = await vercelRequest(connector, `/v13/deployments/get?url=${encodeURIComponent(deploymentUrl)}`);
  const promoted = await vercelRequest(connector, `/v10/projects/${projectId}/promote/${lookup.id}`, { method: "POST" });

  return { promoted: true, deploymentId: lookup.id, result: promoted };
}

export async function deployWorkspacePreview(workspaceId: string, runId: string) {
  const connector = await getWorkspaceConnectorConfig(workspaceId, "vercel", "access_token");
  if (!connector) throw new Error("Connect your Vercel access token before creating a preview.");
  const projectId = typeof connector.metadata.project_id === "string" ? connector.metadata.project_id.trim() : "";
  const gitOrg = typeof connector.metadata.git_org === "string" ? connector.metadata.git_org.trim() : "";
  const gitRepo = typeof connector.metadata.git_repo === "string" ? connector.metadata.git_repo.trim() : "";
  if (!projectId || !gitOrg || !gitRepo) {
    throw new Error("Add the Vercel project and GitHub repository details in Connectors before creating a preview.");
  }
  const branch = `pomebrain/${runId.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`.slice(0, 100);
  const deployment = await vercelRequest(connector, "/v13/deployments", {
    method: "POST",
    body: JSON.stringify({
      name: projectId,
      project: projectId,
      target: "preview",
      gitSource: { type: "github", ref: branch, org: gitOrg, repo: gitRepo },
    }),
  });
  return {
    deploymentId: deployment.id as string,
    previewUrl: `https://${deployment.url}`,
    readyState: deployment.readyState as string,
    branch,
  };
}

export async function verifyWorkspaceVercelConnection(workspaceId: string) {
  const connector = await getWorkspaceConnectorConfig(workspaceId, "vercel", "access_token");
  if (!connector) throw new Error("Connect your Vercel access token before agents deploy.");
  const projectId = typeof connector.metadata.project_id === "string" ? connector.metadata.project_id.trim() : "";
  const gitOrg = typeof connector.metadata.git_org === "string" ? connector.metadata.git_org.trim() : "";
  const gitRepo = typeof connector.metadata.git_repo === "string" ? connector.metadata.git_repo.trim() : "";
  if (!projectId || !gitOrg || !gitRepo) throw new Error("Add the Vercel project and GitHub repository details in Connectors.");
  const project = await vercelRequest(connector, `/v9/projects/${encodeURIComponent(projectId)}`);
  return { provider: "vercel" as const, projectId: project.id as string, projectName: project.name as string, repository: `${gitOrg}/${gitRepo}` };
}

export async function promoteWorkspacePreview({
  workspaceId,
  deploymentId,
  previewUrl,
}: {
  workspaceId: string;
  deploymentId: string;
  previewUrl: string;
}) {
  const connector = await getWorkspaceConnectorConfig(workspaceId, "vercel", "access_token");
  if (!connector) throw new Error("Connect your Vercel access token before promoting a preview.");
  const projectId = typeof connector.metadata.project_id === "string" ? connector.metadata.project_id.trim() : "";
  if (!projectId) throw new Error("Add the Vercel project ID in Connectors before promoting a preview.");

  const promoted = await vercelRequest(connector, `/v10/projects/${encodeURIComponent(projectId)}/promote/${encodeURIComponent(deploymentId)}`, {
    method: "POST",
  });
  const project = await vercelRequest(connector, `/v9/projects/${encodeURIComponent(projectId)}`);
  const aliases = Array.isArray(project?.targets?.production?.alias)
    ? project.targets.production.alias.filter((value: unknown): value is string => typeof value === "string")
    : [];
  const productionUrl = aliases[0] ? `https://${aliases[0]}` : previewUrl;

  return {
    deploymentId,
    previewUrl,
    productionUrl,
    projectId,
    promoted: Boolean(promoted),
  };
}

export async function executeVercelCapability(request: CapabilityRequest) {
  switch (request.capabilityId) {
    case "vercel.deploy.preview":
      return handlePreviewDeploy(request);
    case "vercel.deploy.production":
      return handleProductionPromote(request);
    default:
      throw new Error(`Vercel connector cannot handle capability "${request.capabilityId}".`);
  }
}
