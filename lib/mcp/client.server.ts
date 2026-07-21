import "server-only";

import type { CapabilityRequest } from "@/lib/mcp/capabilities";
import { executeSupabaseCapability } from "@/lib/mcp/connectors/supabase.server";
import { executeModelRouterCapability } from "@/lib/mcp/connectors/model-router.server";
import { executeGitHubCapability } from "@/lib/mcp/connectors/github.server";
import { executeVercelCapability } from "@/lib/mcp/connectors/vercel.server";
import { executeGoogleWorkspaceCapability } from "@/lib/mcp/connectors/google-workspace.server";

const liveCustomerCapabilityIds = new Set<CapabilityRequest["capabilityId"]>([
  "supabase.database.read",
  "supabase.task_state.write",
  "github.pull_requests.create",
  "github.branches.merge",
  "vercel.deploy.preview",
  "vercel.deploy.production",
  "google.drive.read",
  "google.drive.write",
  "google.gmail.send",
  "llm.cross_route",
]);

export type McpExecutionResult =
  | {
      transport: "https-rest" | "in-process";
      mode: "live";
      message: string;
      request: { capabilityId: CapabilityRequest["capabilityId"]; triggeredByAgent: string; associatedPodId: string };
      data: unknown;
    }
  | {
      transport: "https-rest" | "in-process";
      mode: "live_execution_failed";
      message: string;
      request: { capabilityId: CapabilityRequest["capabilityId"]; triggeredByAgent: string; associatedPodId: string };
      error: string;
    }
  | {
      transport: "stdio-json-rpc-2.0";
      mode: "stubbed";
      message: string;
      request: { capabilityId: CapabilityRequest["capabilityId"]; triggeredByAgent: string; associatedPodId: string };
    };

async function routeToLiveConnector(request: CapabilityRequest) {
  switch (request.capabilityId) {
    case "supabase.database.read":
    case "supabase.task_state.write":
      return executeSupabaseCapability(request);
    case "llm.cross_route":
      return executeModelRouterCapability(request);
    case "github.pull_requests.create":
    case "github.branches.merge":
      return executeGitHubCapability(request);
    case "vercel.deploy.preview":
    case "vercel.deploy.production":
      return executeVercelCapability(request);
    case "google.drive.read":
    case "google.drive.write":
    case "google.gmail.send":
      return executeGoogleWorkspaceCapability(request);
    default:
      throw new Error(`No live connector wired for "${request.capabilityId}".`);
  }
}

export async function executeCapabilityThroughMcp(request: CapabilityRequest): Promise<McpExecutionResult> {
  const requestSummary = {
    capabilityId: request.capabilityId,
    triggeredByAgent: request.metadata.triggeredByAgent,
    associatedPodId: request.metadata.associatedPodId,
  };

  if (liveCustomerCapabilityIds.has(request.capabilityId)) {
    try {
      const data = await routeToLiveConnector(request);
      return {
        transport: "https-rest",
        mode: "live",
        message: "Capability executed against a live server-side connector.",
        request: requestSummary,
        data,
      };
    } catch (error) {
      return {
        transport: "https-rest",
        mode: "live_execution_failed",
        message: "Capability was validated and authorized, but the live connector call itself failed.",
        request: requestSummary,
        error: error instanceof Error ? error.message : "Unknown connector error.",
      };
    }
  }

  return {
    transport: "stdio-json-rpc-2.0",
    mode: "stubbed",
    message: "Capability validated and approved for execution. This connector has no live credentials wired yet.",
    request: requestSummary,
  };
}
