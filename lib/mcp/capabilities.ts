import { z } from "zod";

export const CapabilityIdSchema = z.enum([
  "supabase.database.read",
  "supabase.task_state.write",
  "supabase.migrations.apply",
  "github.pull_requests.create",
  "github.branches.merge",
  "vercel.deploy.preview",
  "vercel.deploy.production",
  "google.drive.read",
  "google.drive.write",
  "google.gmail.send",
  "fathom.analytics.read",
  "llm.cross_route",
]);

export type CapabilityId = z.infer<typeof CapabilityIdSchema>;

export const CapabilitySafetyClassSchema = z.enum([
  "safe_read",
  "safe_execution",
  "reversible_write",
  "destructive_write",
  "high_risk_write",
  "consequential_action",
  "external_communication",
]);

export const ApprovalPolicySchema = z.enum([
  "auto_run_allowed",
  "requires_team_confirmation",
  "requires_owner_approval",
]);

export const CapabilityMetadataSchema = z
  .object({
    triggeredByAgent: z.string().min(2).max(120),
    associatedPodId: z.string().min(1).max(80),
  })
  .strict();

export const OwnerSignedCapabilityMetadataSchema = CapabilityMetadataSchema.extend({
  requiresExplicitOwnerSignature: z.literal(true),
}).strict();

export const SupabaseDatabaseReadSchema = z
  .object({
    capabilityId: z.literal("supabase.database.read"),
    payload: z
      .object({
        action: z.enum(["list_tables", "get_table_schema"]),
        tableName: z.string().min(1).max(120).optional(),
      })
      .strict()
      .refine((payload) => payload.action !== "get_table_schema" || Boolean(payload.tableName), {
        message: "tableName is required when action is get_table_schema.",
      }),
    metadata: CapabilityMetadataSchema,
  })
  .strict();

export const SupabaseTaskStateWriteSchema = z
  .object({
    capabilityId: z.literal("supabase.task_state.write"),
    payload: z
      .object({
        projectId: z.string().min(1).max(160),
        taskId: z.string().min(1).max(160),
        nextStatus: z.enum(["pending", "running", "blocked", "failed", "unverified", "approved"]),
        evidenceSeedId: z.string().min(1).max(160).optional(),
        statusReason: z.string().min(1).max(500),
      })
      .strict(),
    metadata: CapabilityMetadataSchema,
  })
  .strict();

export const SupabaseMigrationSchema = z
  .object({
    capabilityId: z.literal("supabase.migrations.apply"),
    payload: z
      .object({
        migrationName: z.string().regex(/^[0-9]+_[a-z_]+\.sql$/),
        rawSqlStatements: z.string().refine(
          (sql) => {
            const bannedRegex = /DROP\s+DATABASE|DROP\s+USER|ALTER\s+ROLE/i;
            return !bannedRegex.test(sql);
          },
          { message: "Security Intercept: Destructive system execution blocked." },
        ),
      })
      .strict(),
    metadata: CapabilityMetadataSchema,
  })
  .strict();

export const GitHubPullRequestSchema = z
  .object({
    capabilityId: z.literal("github.pull_requests.create"),
    payload: z
      .object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        title: z.string().min(1).max(100),
        headBranch: z.string().min(1),
        baseBranch: z.string().default("main"),
        bodyDescription: z.string().min(1),
      })
      .strict(),
    metadata: CapabilityMetadataSchema,
  })
  .strict();

export const GitHubBranchMergeSchema = z
  .object({
    capabilityId: z.literal("github.branches.merge"),
    payload: z
      .object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        headBranch: z.string().min(1),
        baseBranch: z.string().default("main"),
        pullRequestNumber: z.number().int().positive().optional(),
      })
      .strict(),
    metadata: CapabilityMetadataSchema,
  })
  .strict();

export const VercelPreviewDeploySchema = z
  .object({
    capabilityId: z.literal("vercel.deploy.preview"),
    payload: z
      .object({
        projectId: z.string().min(1),
        commitHash: z.string().length(40),
        branch: z.string().min(1),
      })
      .strict(),
    metadata: CapabilityMetadataSchema,
  })
  .strict();

export const VercelProductionDeploySchema = z
  .object({
    capabilityId: z.literal("vercel.deploy.production"),
    payload: z
      .object({
        projectId: z.string().min(1),
        deploymentUrl: z.string().url(),
        commitHash: z.string().length(40),
      })
      .strict(),
    metadata: OwnerSignedCapabilityMetadataSchema,
  })
  .strict();

export const GoogleDriveReadSchema = z
  .object({
    capabilityId: z.literal("google.drive.read"),
    payload: z
      .object({
        fileId: z.string().min(1).optional(),
        folderId: z.string().min(1).optional(),
        query: z.string().min(1).max(500).optional(),
      })
      .strict()
      .refine((payload) => Boolean(payload.fileId || payload.folderId || payload.query), {
        message: "Provide fileId, folderId, or query for Google Drive reads.",
      }),
    metadata: CapabilityMetadataSchema,
  })
  .strict();

export const GoogleDriveWriteSchema = z
  .object({
    capabilityId: z.literal("google.drive.write"),
    payload: z
      .object({
        folderId: z.string().min(1),
        fileName: z.string().min(1).max(180),
        mimeType: z.string().min(1).max(120),
        contentDigest: z.string().min(16).max(128),
        sourceArtifactId: z.string().min(1).max(160),
      })
      .strict(),
    metadata: CapabilityMetadataSchema,
  })
  .strict();

export const GoogleGmailSendSchema = z
  .object({
    capabilityId: z.literal("google.gmail.send"),
    payload: z
      .object({
        to: z.array(z.string().email()).min(1).max(10),
        cc: z.array(z.string().email()).max(10).optional(),
        subject: z.string().min(1).max(160),
        bodyPreview: z.string().min(1).max(1000),
        draftArtifactId: z.string().min(1).max(160),
      })
      .strict(),
    metadata: CapabilityMetadataSchema,
  })
  .strict();

export const FathomAnalyticsReadSchema = z
  .object({
    capabilityId: z.literal("fathom.analytics.read"),
    payload: z
      .object({
        siteId: z.string().min(1),
        metric: z.enum(["pageviews", "visits", "conversions", "referrers", "events"]),
        dateFrom: z.string().date(),
        dateTo: z.string().date(),
      })
      .strict(),
    metadata: CapabilityMetadataSchema,
  })
  .strict();

export const LlmCrossRouteSchema = z
  .object({
    capabilityId: z.literal("llm.cross_route"),
    payload: z
      .object({
        preferredProviders: z.array(z.enum(["claude", "openai", "gemini"])).min(1).max(3),
        taskClass: z.enum(["brief", "code", "research", "review", "summarize", "reasoning"]),
        complexity: z.enum(["low", "medium", "high"]),
        maxBudgetUsd: z.number().positive().max(500).optional(),
      })
      .strict(),
    metadata: CapabilityMetadataSchema,
  })
  .strict();

export const CapabilityRequestSchema = z.discriminatedUnion("capabilityId", [
  SupabaseDatabaseReadSchema,
  SupabaseTaskStateWriteSchema,
  SupabaseMigrationSchema,
  GitHubPullRequestSchema,
  GitHubBranchMergeSchema,
  VercelPreviewDeploySchema,
  VercelProductionDeploySchema,
  GoogleDriveReadSchema,
  GoogleDriveWriteSchema,
  GoogleGmailSendSchema,
  FathomAnalyticsReadSchema,
  LlmCrossRouteSchema,
]);

export type CapabilityRequest = z.infer<typeof CapabilityRequestSchema>;

export type CapabilityDefinition = {
  id: CapabilityId;
  connectorId:
    | "supabase_connector"
    | "github_connector"
    | "vercel_connector"
    | "anthropic_connector"
    | "openai_connector"
    | "google_workspace_connector"
    | "fathom_connector"
    | "model_router";
  targetActions: string[];
  safetyClass: z.infer<typeof CapabilitySafetyClassSchema>;
  approvalPolicy: z.infer<typeof ApprovalPolicySchema>;
};

export const capabilityRegistry: Record<CapabilityId, CapabilityDefinition> = {
  "supabase.database.read": {
    id: "supabase.database.read",
    connectorId: "supabase_connector",
    targetActions: ["list_tables", "get_table_schema"],
    safetyClass: "safe_read",
    approvalPolicy: "auto_run_allowed",
  },
  "supabase.task_state.write": {
    id: "supabase.task_state.write",
    connectorId: "supabase_connector",
    targetActions: ["update_task_status"],
    safetyClass: "reversible_write",
    approvalPolicy: "auto_run_allowed",
  },
  "supabase.migrations.apply": {
    id: "supabase.migrations.apply",
    connectorId: "supabase_connector",
    targetActions: ["execute_sql"],
    safetyClass: "destructive_write",
    approvalPolicy: "requires_team_confirmation",
  },
  "github.pull_requests.create": {
    id: "github.pull_requests.create",
    connectorId: "github_connector",
    targetActions: ["create_pull_request"],
    safetyClass: "reversible_write",
    approvalPolicy: "auto_run_allowed",
  },
  "github.branches.merge": {
    id: "github.branches.merge",
    connectorId: "github_connector",
    targetActions: ["merge_branch"],
    safetyClass: "high_risk_write",
    approvalPolicy: "requires_team_confirmation",
  },
  "vercel.deploy.preview": {
    id: "vercel.deploy.preview",
    connectorId: "vercel_connector",
    targetActions: ["create_preview_deployment"],
    safetyClass: "safe_execution",
    approvalPolicy: "auto_run_allowed",
  },
  "vercel.deploy.production": {
    id: "vercel.deploy.production",
    connectorId: "vercel_connector",
    targetActions: ["promote_to_production"],
    safetyClass: "consequential_action",
    approvalPolicy: "requires_owner_approval",
  },
  "google.drive.read": {
    id: "google.drive.read",
    connectorId: "google_workspace_connector",
    targetActions: ["drive.files.read"],
    safetyClass: "safe_read",
    approvalPolicy: "auto_run_allowed",
  },
  "google.drive.write": {
    id: "google.drive.write",
    connectorId: "google_workspace_connector",
    targetActions: ["drive.files.write"],
    safetyClass: "reversible_write",
    approvalPolicy: "auto_run_allowed",
  },
  "google.gmail.send": {
    id: "google.gmail.send",
    connectorId: "google_workspace_connector",
    targetActions: ["gmail.messages.send"],
    safetyClass: "external_communication",
    approvalPolicy: "requires_team_confirmation",
  },
  "fathom.analytics.read": {
    id: "fathom.analytics.read",
    connectorId: "fathom_connector",
    targetActions: ["analytics.query"],
    safetyClass: "safe_read",
    approvalPolicy: "auto_run_allowed",
  },
  "llm.cross_route": {
    id: "llm.cross_route",
    connectorId: "model_router",
    targetActions: ["model.route"],
    safetyClass: "safe_execution",
    approvalPolicy: "auto_run_allowed",
  },
};

const forgedControlKeys = new Set([
  "authorization",
  "authorizationBlock",
  "approvalOverride",
  "ownerSignature",
  "rawCredential",
  "rawCredentials",
  "serviceRoleKey",
  "token",
  "apiKey",
  "secret",
  "clientSecret",
  "refreshToken",
]);

function containsForgedControlField(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsForgedControlField);

  return Object.entries(value).some(([key, child]) => forgedControlKeys.has(key) || containsForgedControlField(child));
}

export function assertNoForgedAuthorizationBlock(rawRequest: unknown) {
  if (containsForgedControlField(rawRequest)) {
    throw new Error("Policy violation: forged authorization, approval, or credential field detected.");
  }
}

export function parseCapabilityRequest(rawRequest: unknown) {
  assertNoForgedAuthorizationBlock(rawRequest);
  return CapabilityRequestSchema.parse(rawRequest);
}

export function getCapabilityDefinition(capabilityId: CapabilityId) {
  return capabilityRegistry[capabilityId];
}

export function requiresApproval(capabilityId: CapabilityId) {
  return capabilityRegistry[capabilityId].approvalPolicy !== "auto_run_allowed";
}
