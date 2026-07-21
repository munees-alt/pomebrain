import { z } from "zod";

export const ProjectStatusSchema = z.enum(["draft", "planning", "building", "testing", "deployed", "archived"]);
export const ProjectRunStatusSchema = z.enum(["idle", "processing", "blocked_by_approval", "failed", "success"]);
export const BuildTaskStatusSchema = z.enum(["pending", "running", "completed", "failed", "skipped"]);
export const ApprovalRiskLevelSchema = z.enum(["low", "medium", "high", "destructive"]);
export const ApprovalStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const ProjectRowSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  status: ProjectStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const ProjectRunRowSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  project_id: z.string().uuid(),
  status: ProjectRunStatusSchema,
  active_orchestrator_version_id: z.string().uuid(),
  total_token_cost: z.number().nonnegative(),
  execution_context: z.record(z.string(), z.unknown()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const BuildTaskRowSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  run_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().nullable(),
  assigned_agent_version_id: z.string().uuid(),
  dependencies: z.array(z.string().uuid()),
  status: BuildTaskStatusSchema,
  task_key: z.string().max(80).nullable().optional(),
  attempt_count: z.number().int().nonnegative().optional(),
  started_at: z.string().datetime().nullable().optional(),
  completed_at: z.string().datetime().nullable().optional(),
  last_error: z.string().nullable().optional(),
  result_payload: z.record(z.string(), z.unknown()).optional(),
  output_logs: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  sequence_order: z.number().int().nonnegative(),
});

export const ApprovalQueueRowSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  run_id: z.string().uuid(),
  task_id: z.string().uuid(),
  requested_capability: z.string().min(1).max(100),
  proposed_payload: z.record(z.string(), z.unknown()),
  risk_level: ApprovalRiskLevelSchema,
  status: ApprovalStatusSchema,
  reviewed_by: z.string().uuid().nullable(),
  reviewed_at: z.string().datetime().nullable(),
  rejection_reason: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ProjectRunStatus = z.infer<typeof ProjectRunStatusSchema>;
export type BuildTaskStatus = z.infer<typeof BuildTaskStatusSchema>;
export type ApprovalRiskLevel = z.infer<typeof ApprovalRiskLevelSchema>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
