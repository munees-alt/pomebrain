import { z } from "zod";

export const seedKinds = [
  "agent",
  "skill",
  "tool",
  "connector",
  "knowledge",
  "decision",
  "evidence",
  "policy",
  "evaluation",
  "project",
  "artifact",
  "conflict",
] as const;

export const seedStatuses = [
  "draft",
  "review",
  "approved",
  "deprecated",
  "rejected",
  "archived",
] as const;

export const edgeKinds = [
  "uses",
  "requires",
  "produces",
  "belongs_to",
  "created_by",
  "learned_from",
  "supported_by",
  "validated_by",
  "contradicts",
  "supersedes",
  "applies_to",
  "failed_in",
  "similar_to",
] as const;

export const SeedSchema = z.object({
  id: z.string().min(1),
  versionId: z.string().min(1),
  kind: z.enum(seedKinds),
  name: z.string().min(2).max(120),
  summary: z.string().min(1).max(500),
  status: z.enum(seedStatuses),
  podId: z.string().min(1),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const EdgeSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  kind: z.enum(edgeKinds),
  strength: z.number().min(0).max(1),
  createdAt: z.string().datetime(),
});

export const CrownGoalSchema = z.object({
  goal: z
    .string()
    .trim()
    .min(12, "Give the Crown a little more detail so it can route the right agents.")
    .max(1200),
});

export const BuildStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  agent: z.string(),
  status: z.enum(["queued", "ready", "approval", "running", "complete"]),
});

export const ConnectorPlanCandidateSchema = z.object({
  connectorId: z.string(),
  title: z.string(),
  capabilityIds: z.array(z.string()),
  ready: z.boolean(),
  customerOwned: z.boolean(),
});

export const ConnectorPlanRequirementSchema = z.object({
  requirement: z.string(),
  label: z.string(),
  reason: z.string(),
  candidates: z.array(ConnectorPlanCandidateSchema),
});

export const CrownRunSchema = z.object({
  id: z.string(),
  goal: z.string(),
  title: z.string(),
  createdAt: z.string().datetime(),
  status: z.enum(["planning", "awaiting_approval", "approved", "executing", "complete"]),
  agents: z.array(z.string()).min(1),
  skills: z.array(z.string()),
  steps: z.array(BuildStepSchema).min(1),
  connectorPlan: z.array(ConnectorPlanRequirementSchema),
  approvalRequired: z.boolean(),
});

export type Seed = z.infer<typeof SeedSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type CrownGoal = z.infer<typeof CrownGoalSchema>;
export type CrownRun = z.infer<typeof CrownRunSchema>;
export type SeedKind = (typeof seedKinds)[number];
