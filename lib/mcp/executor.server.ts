import "server-only";

import { ZodError } from "zod";
import {
  getCapabilityDefinition,
  parseCapabilityRequest,
  requiresApproval,
  type CapabilityRequest,
} from "@/lib/mcp/capabilities";
import { recordCapabilityAuditEvent } from "@/lib/mcp/audit.server";
import { executeCapabilityThroughMcp } from "@/lib/mcp/client.server";

export type CapabilityExecutionResponse =
  | {
      status: "accepted";
      capabilityId: CapabilityRequest["capabilityId"];
      safetyClass: string;
      approvalPolicy: string;
      auditId: string;
      result: Awaited<ReturnType<typeof executeCapabilityThroughMcp>>;
    }
  | {
      status: "requires_approval";
      capabilityId: CapabilityRequest["capabilityId"];
      safetyClass: string;
      approvalPolicy: string;
      auditId: string;
      message: string;
    }
  | {
      status: "rejected";
      auditId: string;
      message: string;
      issues?: string[];
    };

function validationIssues(error: unknown) {
  if (error instanceof ZodError) return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  if (error instanceof Error) return [error.message];
  return ["Unknown validation error."];
}

export async function executeGovernedCapability(rawRequest: unknown): Promise<CapabilityExecutionResponse> {
  let request: CapabilityRequest;

  try {
    request = parseCapabilityRequest(rawRequest);
  } catch (error) {
    const audit = recordCapabilityAuditEvent({
      decision: "rejected",
      signature: "capability.validation_or_policy_rejection",
      message: "Capability request failed strict validation or perimeter policy checks.",
    });

    return {
      status: "rejected",
      auditId: audit.id,
      message: "Capability request rejected before MCP routing.",
      issues: validationIssues(error),
    };
  }

  const definition = getCapabilityDefinition(request.capabilityId);

  if (requiresApproval(request.capabilityId)) {
    const audit = recordCapabilityAuditEvent({
      capabilityId: request.capabilityId,
      triggeredByAgent: request.metadata.triggeredByAgent,
      associatedPodId: request.metadata.associatedPodId,
      decision: "requires_approval",
      signature: `${request.capabilityId}.approval_required`,
      message: "Capability is valid but blocked pending required human approval.",
    });

    return {
      status: "requires_approval",
      capabilityId: request.capabilityId,
      safetyClass: definition.safetyClass,
      approvalPolicy: definition.approvalPolicy,
      auditId: audit.id,
      message: "Capability is valid but requires approval before live MCP execution.",
    };
  }

  const result = await executeCapabilityThroughMcp(request);
  const audit = recordCapabilityAuditEvent({
    capabilityId: request.capabilityId,
    triggeredByAgent: request.metadata.triggeredByAgent,
    associatedPodId: request.metadata.associatedPodId,
    decision: "allowed",
    signature: `${request.capabilityId}.allowed`,
    message: "Capability validated and routed to the server-side MCP execution boundary.",
  });

  return {
    status: "accepted",
    capabilityId: request.capabilityId,
    safetyClass: definition.safetyClass,
    approvalPolicy: definition.approvalPolicy,
    auditId: audit.id,
    result,
  };
}

