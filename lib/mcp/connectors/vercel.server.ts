import "server-only";

import type { CapabilityRequest } from "@/lib/mcp/capabilities";

const VERCEL_TOKEN = process.env.POMEBRAIN_VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.POMEBRAIN_VERCEL_TEAM_ID;
const VERCEL_API = "https://api.vercel.com";

function assertConfigured() {
  if (!VERCEL_TOKEN) {
    throw new Error("Vercel connector is not configured: missing POMEBRAIN_VERCEL_TOKEN.");
  }
}

function withTeam(path: string) {
  if (!VERCEL_TEAM_ID) return path;
  return `${path}${path.includes("?") ? "&" : "?"}teamId=${VERCEL_TEAM_ID}`;
}

async function vercelRequest(path: string, init: RequestInit = {}) {
  assertConfigured();

  const response = await fetch(`${VERCEL_API}${withTeam(path)}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
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

  const deployment = await vercelRequest("/v13/deployments", {
    method: "POST",
    body: JSON.stringify({
      name: "pomebrain",
      project: projectId,
      target: "preview",
      gitSource: { type: "github", ref: branch, org: "munees-alt", repo: "pomebrain" },
    }),
  });

  return { id: deployment.id, url: deployment.url, readyState: deployment.readyState };
}

async function handleProductionPromote(request: Extract<CapabilityRequest, { capabilityId: "vercel.deploy.production" }>) {
  const { projectId, deploymentUrl } = request.payload;

  const lookup = await vercelRequest(`/v13/deployments/get?url=${encodeURIComponent(deploymentUrl)}`);
  const promoted = await vercelRequest(`/v10/projects/${projectId}/promote/${lookup.id}`, { method: "POST" });

  return { promoted: true, deploymentId: lookup.id, result: promoted };
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
