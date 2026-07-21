import "server-only";

import { agentSlugForName } from "@/lib/app-factory/agent-registry";
import type { CrownRun } from "@/lib/domain";

type SeedRow = {
  slug: string;
  current_version_id: string | null;
};

type IdRow = {
  id: string;
};

type SupabaseResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type SupabaseInsertTable = {
  insert: (body: unknown) => {
    select: (columns: string) => {
      single: () => PromiseLike<SupabaseResult<IdRow>>;
    };
  };
};

export type SupabaseAppFactoryClient = {
  from: {
    (table: "projects" | "project_runs" | "build_tasks" | "approval_queue"): SupabaseInsertTable;
  };
};

export type PersistedAppFactoryRun = {
  projectId: string;
  runId: string;
  status: "processing";
  taskCount: number;
  approvalCount: number;
};

function assertIdRow(row: unknown, label: string): asserts row is IdRow {
  if (!row || typeof row !== "object" || typeof (row as { id?: unknown }).id !== "string") {
    throw new Error(`Supabase did not return an id for ${label}.`);
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

async function resolvePlatformAgentVersions(agentSlugs: string[]) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Server cannot resolve protected agents: missing Supabase service credentials.");
  }

  const slugFilter = agentSlugs.map((slug) => `"${slug.replaceAll('"', '\\"')}"`).join(",");
  const response = await fetch(`${supabaseUrl}/rest/v1/seeds?select=slug,current_version_id&type=eq.agent&slug=in.(${slugFilter})`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Server could not resolve protected agent versions (${response.status}).`);
  }

  const rows = (await response.json()) as SeedRow[];
  return new Map(rows.map((row) => [row.slug, row.current_version_id]));
}

export async function createPersistedAppFactoryRun({
  supabase,
  workspaceId,
  approvedByUserId,
  run,
}: {
  supabase: SupabaseAppFactoryClient;
  workspaceId: string;
  approvedByUserId: string;
  run: CrownRun;
}): Promise<PersistedAppFactoryRun> {
  const agentSlugs = unique(["Pomebrain Architect Orchestrator", ...run.steps.map((step) => step.agent)].map(agentSlugForName));
  const versionBySlug = await resolvePlatformAgentVersions(agentSlugs);
  const missing = agentSlugs.filter((slug) => !versionBySlug.get(slug));
  if (missing.length > 0) {
    throw new Error(`Protected platform agent version(s) are missing: ${missing.join(", ")}.`);
  }

  const projectResult = await supabase
    .from("projects")
    .insert({
      workspace_id: workspaceId,
      name: run.title,
      description: run.goal,
      status: "planning",
    })
    .select("id")
    .single();
  if (projectResult.error) throw new Error(projectResult.error.message);
  assertIdRow(projectResult.data, "project");

  const orchestratorVersionId = versionBySlug.get(agentSlugForName("Pomebrain Architect Orchestrator"));
  const runResult = await supabase
    .from("project_runs")
    .insert({
      workspace_id: workspaceId,
      project_id: projectResult.data.id,
      status: "processing",
      active_orchestrator_version_id: orchestratorVersionId,
      execution_context: {
        source: "crown_console",
        release: "app_factory",
        crown_plan_id: run.id,
        approved_by: approvedByUserId,
        approved_at: new Date().toISOString(),
        agents: run.agents,
        skills: run.skills,
        plan: run,
      },
    })
    .select("id")
    .single();
  if (runResult.error) throw new Error(runResult.error.message);
  assertIdRow(runResult.data, "project run");

  let approvalCount = 0;

  for (const [index, step] of run.steps.entries()) {
    const assignedAgentVersionId = versionBySlug.get(agentSlugForName(step.agent));
    const taskResult = await supabase
      .from("build_tasks")
      .insert({
        workspace_id: workspaceId,
        run_id: runResult.data.id,
        title: step.title,
        task_key: step.id,
        description: step.detail,
        assigned_agent_version_id: assignedAgentVersionId,
        dependencies: [],
        status: "pending",
        sequence_order: index + 1,
      })
      .select("id")
      .single();
    if (taskResult.error) throw new Error(taskResult.error.message);
    assertIdRow(taskResult.data, `build task "${step.title}"`);

    if (step.status === "approval" || step.id === "build") {
      const approvalResult = await supabase
        .from("approval_queue")
        .insert({
          workspace_id: workspaceId,
          run_id: runResult.data.id,
          task_id: taskResult.data.id,
          requested_capability: step.id === "build"
            ? "github.repository.write"
            : step.id === "handoff"
              ? "vercel.deploy.preview"
              : step.id === "publish"
                ? "vercel.deploy.production"
                : "app_factory.verify_artifact",
          proposed_payload: {
            crown_plan_id: run.id,
            step_id: step.id,
            step_title: step.title,
          },
          risk_level: step.id === "publish" ? "destructive" : step.id === "handoff" || step.id === "build" ? "high" : "medium",
          status: "pending",
        })
        .select("id")
        .single();
      if (approvalResult.error) throw new Error(approvalResult.error.message);
      assertIdRow(approvalResult.data, `approval for "${step.title}"`);
      approvalCount += 1;
    }
  }

  return {
    projectId: projectResult.data.id,
    runId: runResult.data.id,
    status: "processing",
    taskCount: run.steps.length,
    approvalCount,
  };
}
