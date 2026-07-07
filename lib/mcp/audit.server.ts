import "server-only";

import type { CapabilityId } from "@/lib/mcp/capabilities";

export type CapabilityAuditEvent = {
  id: string;
  createdAt: string;
  capabilityId?: CapabilityId;
  triggeredByAgent?: string;
  associatedPodId?: string;
  decision: "allowed" | "requires_approval" | "rejected";
  signature: string;
  message: string;
};

const auditTrail: CapabilityAuditEvent[] = [];

export function recordCapabilityAuditEvent(event: Omit<CapabilityAuditEvent, "id" | "createdAt">) {
  const auditEvent: CapabilityAuditEvent = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...event,
  };

  auditTrail.unshift(auditEvent);
  return auditEvent;
}

export function getCapabilityAuditTrail() {
  return auditTrail.slice(0, 100);
}

