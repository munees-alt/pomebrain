import "server-only";

import type { CapabilityRequest } from "@/lib/mcp/capabilities";

export type McpExecutionResult = {
  transport: "stdio-json-rpc-2.0";
  mode: "stubbed";
  message: string;
  request: {
    capabilityId: CapabilityRequest["capabilityId"];
    triggeredByAgent: string;
    associatedPodId: string;
  };
};

export async function executeCapabilityThroughMcp(request: CapabilityRequest): Promise<McpExecutionResult> {
  return {
    transport: "stdio-json-rpc-2.0",
    mode: "stubbed",
    message: "Capability validated and approved for execution. Live MCP adapter spawning is not enabled in Phase 0.",
    request: {
      capabilityId: request.capabilityId,
      triggeredByAgent: request.metadata.triggeredByAgent,
      associatedPodId: request.metadata.associatedPodId,
    },
  };
}

