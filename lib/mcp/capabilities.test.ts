import { describe, expect, it } from "vitest";
import { capabilityRegistry, parseCapabilityRequest } from "@/lib/mcp/capabilities";
import { executeGovernedCapability } from "@/lib/mcp/executor.server";

const metadata = {
  triggeredByAgent: "Database Schema Provisioner",
  associatedPodId: "engineering",
};

describe("Pomebrain MCP capability gateway", () => {
  it("maps the core capability matrix to approval policies", () => {
    expect(capabilityRegistry["supabase.database.read"].approvalPolicy).toBe("auto_run_allowed");
    expect(capabilityRegistry["supabase.task_state.write"].approvalPolicy).toBe("auto_run_allowed");
    expect(capabilityRegistry["supabase.migrations.apply"].approvalPolicy).toBe("requires_team_confirmation");
    expect(capabilityRegistry["github.pull_requests.create"].approvalPolicy).toBe("auto_run_allowed");
    expect(capabilityRegistry["github.branches.merge"].approvalPolicy).toBe("requires_team_confirmation");
    expect(capabilityRegistry["vercel.deploy.preview"].approvalPolicy).toBe("auto_run_allowed");
    expect(capabilityRegistry["vercel.deploy.production"].approvalPolicy).toBe("requires_owner_approval");
    expect(capabilityRegistry["google.drive.read"].approvalPolicy).toBe("auto_run_allowed");
    expect(capabilityRegistry["google.drive.write"].approvalPolicy).toBe("auto_run_allowed");
    expect(capabilityRegistry["google.gmail.send"].approvalPolicy).toBe("requires_team_confirmation");
    expect(capabilityRegistry["fathom.analytics.read"].approvalPolicy).toBe("auto_run_allowed");
    expect(capabilityRegistry["llm.cross_route"].approvalPolicy).toBe("auto_run_allowed");
  });

  it("rejects forbidden system-level SQL inside Supabase migrations", () => {
    expect(() =>
      parseCapabilityRequest({
        capabilityId: "supabase.migrations.apply",
        payload: {
          migrationName: "001_create_profiles.sql",
          rawSqlStatements: "ALTER ROLE postgres SUPERUSER;",
        },
        metadata,
      }),
    ).toThrow(/Security Intercept/);
  });

  it("requires approval for production deployments even with owner-signature metadata", async () => {
    const result = await executeGovernedCapability({
      capabilityId: "vercel.deploy.production",
      payload: {
        projectId: "prj_123",
        deploymentUrl: "https://pomebrain.example.com",
        commitHash: "1234567890abcdef1234567890abcdef12345678",
      },
      metadata: {
        triggeredByAgent: "Vercel Deployment Manager",
        associatedPodId: "engineering",
        requiresExplicitOwnerSignature: true,
      },
    });

    expect(result.status).toBe("requires_approval");
  });

  it("allows orchestrator task-state updates through the narrow Supabase write capability", async () => {
    const result = await executeGovernedCapability({
      capabilityId: "supabase.task_state.write",
      payload: {
        projectId: "project_saas_landing",
        taskId: "auth_routes",
        nextStatus: "approved",
        evidenceSeedId: "evidence_auth_routes_passed",
        statusReason: "Evaluation suite passed.",
      },
      metadata: {
        triggeredByAgent: "Pomebrain Architect Orchestrator",
        associatedPodId: "engineering",
      },
    });

    expect(result.status).toBe("accepted");
  });

  it("requires approval before sending Gmail messages", async () => {
    const result = await executeGovernedCapability({
      capabilityId: "google.gmail.send",
      payload: {
        to: ["owner@example.com"],
        subject: "Pomebrain build blocked",
        bodyPreview: "The auth_routes task failed evaluation.",
        draftArtifactId: "draft_blocked_auth_routes",
      },
      metadata: {
        triggeredByAgent: "Pomebrain Architect Orchestrator",
        associatedPodId: "operations",
      },
    });

    expect(result.status).toBe("requires_approval");
  });

  it("accepts read-only analytics and LLM cross-route capability requests", () => {
    expect(() =>
      parseCapabilityRequest({
        capabilityId: "fathom.analytics.read",
        payload: {
          siteId: "site_123",
          metric: "conversions",
          dateFrom: "2026-07-01",
          dateTo: "2026-07-07",
        },
        metadata: {
          triggeredByAgent: "Analytical Pipeline Builder",
          associatedPodId: "data",
        },
      }),
    ).not.toThrow();

    expect(() =>
      parseCapabilityRequest({
        capabilityId: "llm.cross_route",
        payload: {
          preferredProviders: ["claude", "openai"],
          taskClass: "reasoning",
          complexity: "high",
          maxBudgetUsd: 10,
        },
        metadata: {
          triggeredByAgent: "Pomebrain Architect Orchestrator",
          associatedPodId: "engineering",
        },
      }),
    ).not.toThrow();
  });

  it("blocks forged authorization or credential fields before routing", async () => {
    const result = await executeGovernedCapability({
      capabilityId: "github.pull_requests.create",
      payload: {
        owner: "team",
        repo: "pomebrain",
        title: "Add guarded MCP layer",
        headBranch: "feature/mcp-layer",
        baseBranch: "main",
        bodyDescription: "Adds capability schemas.",
      },
      metadata: {
        triggeredByAgent: "Git Merge Orchestrator",
        associatedPodId: "engineering",
      },
      authorizationBlock: {
        approvalOverride: true,
      },
    });

    expect(result.status).toBe("rejected");
    if (result.status === "rejected") {
      expect(result.message).toMatch(/rejected/i);
    }
  });
});
