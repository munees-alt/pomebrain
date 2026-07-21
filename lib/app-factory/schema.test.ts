import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ApprovalQueueRowSchema,
  BuildTaskRowSchema,
  ProjectRowSchema,
  ProjectRunRowSchema,
} from "@/lib/app-factory/schema";

const createdAt = "2026-07-07T00:00:00.000Z";
const workspaceId = "00000000-0000-4000-8000-000000000000";
const projectId = "00000000-0000-4000-8000-000000000001";
const runId = "00000000-0000-4000-8000-000000000002";
const taskId = "00000000-0000-4000-8000-000000000003";
const agentVersionId = "00000000-0000-4000-8000-000000000005";

describe("App Factory Phase 4 schema assets", () => {
  it("stores the required Supabase migration tables", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/01_unified_pomebrain_core.sql"), "utf8");

    expect(sql).toContain("CREATE TABLE public.seeds");
    expect(sql).toContain("CREATE TABLE public.seed_versions");
    expect(sql).toContain("CREATE TABLE public.fibres");
    expect(sql).toContain("CREATE TABLE public.projects");
    expect(sql).toContain("CREATE TABLE public.project_runs");
    expect(sql).toContain("CREATE TABLE public.build_tasks");
    expect(sql).toContain("CREATE TABLE public.approval_queue");
    expect(sql).toContain("CREATE TABLE public.audit_events");
    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS vector");
    expect(sql).toContain("$$ LANGUAGE plpgsql SECURITY DEFINER");
    expect(sql).not.toMatch(/CREATE POLICY\s+\w+\s+ON public\.audit_events\s+FOR\s+(UPDATE|DELETE)/i);
  });

  it("includes a LEARNED_FROM write-back smoke test", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/tests/learned_from_writeback_smoke.sql"), "utf8");

    expect(sql).toContain("relationship_type");
    expect(sql).toContain("'LEARNED_FROM'");
    expect(sql).toContain("IF v_count <> 1 THEN");
  });

  it("claims pending App Factory work atomically under caller RLS", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/13_atomic_app_factory_task_claim.sql"), "utf8");

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.claim_app_factory_task");
    expect(sql).toContain("AND status = 'pending'");
    expect(sql).toContain("SECURITY INVOKER");
    expect(sql).toContain("RETURNING *");
  });

  it("records attempts, structured deliverables, and recovers interrupted tasks", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/14_resumable_app_factory_delivery.sql"), "utf8");

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS task_key");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS attempt_count");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS result_payload");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.recover_stale_app_factory_tasks");
    expect(sql).toContain("attempt_count = attempt_count + 1");
    expect(sql).toContain("SECURITY INVOKER");
  });

  it("audits graph-core seed, version, fibre, and project mutations", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/03_audit_graph_core_tables.sql"), "utf8");

    expect(sql).toContain("CREATE TRIGGER audit_seeds");
    expect(sql).toContain("CREATE TRIGGER audit_seed_versions");
    expect(sql).toContain("CREATE TRIGGER audit_fibres");
    expect(sql).toContain("CREATE TRIGGER audit_projects");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).not.toMatch(/CREATE POLICY\s+\w+\s+ON public\.audit_events\s+FOR\s+(UPDATE|DELETE)/i);
  });

  it("provisions workspace_id into auth app metadata, not user metadata", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/02_auth_workspace_provisioning.sql"), "utf8");

    expect(sql).toContain("CREATE TABLE public.workspaces");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("AFTER INSERT ON auth.users");
    expect(sql).toContain("raw_app_meta_data");
    expect(sql).not.toContain("raw_user_meta_data");
    expect(sql).toContain("workspace_id");
  });

  it("validates representative App Factory rows", () => {
    expect(() =>
      ProjectRowSchema.parse({
        id: projectId,
        workspace_id: workspaceId,
        name: "SaaS Landing Page",
        description: "Landing page with auth and waitlist.",
        status: "planning",
        created_at: createdAt,
        updated_at: createdAt,
      }),
    ).not.toThrow();

    expect(() =>
      ProjectRunRowSchema.parse({
        id: runId,
        workspace_id: workspaceId,
        project_id: projectId,
        status: "blocked_by_approval",
        active_orchestrator_version_id: agentVersionId,
        total_token_cost: 2.75,
        execution_context: { branch: "feature/saas-landing" },
        created_at: createdAt,
        updated_at: createdAt,
      }),
    ).not.toThrow();

    expect(() =>
      BuildTaskRowSchema.parse({
        id: taskId,
        workspace_id: workspaceId,
        run_id: runId,
        title: "Deploy preview",
        description: "Create Vercel preview build.",
        assigned_agent_version_id: agentVersionId,
        dependencies: [],
        status: "running",
        output_logs: null,
        created_at: createdAt,
        updated_at: createdAt,
        sequence_order: 4,
      }),
    ).not.toThrow();

    expect(() =>
      ApprovalQueueRowSchema.parse({
        id: "00000000-0000-4000-8000-000000000004",
        workspace_id: workspaceId,
        run_id: runId,
        task_id: taskId,
        requested_capability: "vercel.deploy.production",
        proposed_payload: { deploymentUrl: "https://pomebrain.example.com" },
        risk_level: "high",
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
        created_at: createdAt,
        updated_at: createdAt,
      }),
    ).not.toThrow();
  });
});
