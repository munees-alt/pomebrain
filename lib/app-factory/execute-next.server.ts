import "server-only";
import { executeModelRouterCapability } from "@/lib/mcp/connectors/model-router.server";
import { commitFilesToWorkspaceRepository, getWorkspaceGitHubRepository, type RepositoryFile } from "@/lib/mcp/connectors/github.server";
import { deployWorkspacePreview, promoteWorkspacePreview } from "@/lib/mcp/connectors/vercel.server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin.server";
import { assertPrivilegedAppFactoryContext } from "@/lib/app-factory/permission-guard";

type QueryResult<T> = Promise<{ data: T; error: { message: string } | null }>;
type RunClient = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          order(column: string, options: { ascending: boolean }): {
            limit(count: number): QueryResult<unknown[]>;
          };
          maybeSingle(): QueryResult<unknown>;
        };
        order(column: string, options: { ascending: boolean }): {
          limit(count: number): QueryResult<unknown[]>;
        };
        maybeSingle(): QueryResult<unknown>;
      };
    };
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): QueryResult<unknown>;
    };
  };
  rpc(name: string, args: Record<string, unknown>): QueryResult<unknown>;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  assigned_agent_version_id: string;
  sequence_order: number;
  status: string;
  task_key?: string | null;
  attempt_count?: number;
  output_logs?: string | null;
};

function taskClass(title: string): "brief" | "code" | "research" | "review" | "summarize" | "reasoning" {
  const value = title.toLowerCase();
  if (/test|verify|audit|review/.test(value)) return "review";
  if (/research|market|competitor/.test(value)) return "research";
  if (/brief|requirement|understand/.test(value)) return "brief";
  if (/build|implement|schema|interface|deploy|code/.test(value)) return "code";
  return "reasoning";
}

function taskMatches(task: TaskRow, key: string, fallback: RegExp) {
  return task.task_key === key || (!task.task_key && fallback.test(task.title));
}

function parseRepositoryManifest(text: string): { summary: string; files: RepositoryFile[] } {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = (fenced ?? text).trim();
  const parsed = JSON.parse(raw) as { summary?: unknown; files?: unknown };
  if (!Array.isArray(parsed.files)) throw new Error("The build agent returned an invalid file manifest.");
  const files = parsed.files.map((item) => {
    if (!item || typeof item !== "object") throw new Error("The build agent returned an invalid file entry.");
    const path = (item as { path?: unknown }).path;
    const content = (item as { content?: unknown }).content;
    if (typeof path !== "string" || typeof content !== "string") throw new Error("Each generated file needs a path and text content.");
    return { path, content };
  });
  return { summary: typeof parsed.summary === "string" ? parsed.summary : "Repository files generated.", files };
}

export async function executeNextAppFactoryTask({
  supabase,
  authenticatedUserId,
  workspaceId,
  runId,
}: {
  supabase: RunClient;
  authenticatedUserId: string;
  workspaceId: string;
  runId: string;
}) {
  const runResult = await supabase.from("project_runs").select("id,workspace_id,project_id,status").eq("id", runId).eq("workspace_id", workspaceId).maybeSingle();
  if (runResult.error) throw new Error(runResult.error.message);
  const run = runResult.data as { id: string; workspace_id: string; project_id: string; status: string } | null;
  if (!run) throw new Error("Build run not found in this workspace.");
  if (run.status === "failed") throw new Error("This build was stopped after an approval was rejected.");

  const recoveryResult = await supabase.rpc("recover_stale_app_factory_tasks", {
    p_workspace_id: workspaceId,
    p_run_id: runId,
  });
  if (recoveryResult.error) throw new Error(recoveryResult.error.message);

  const runningResult = await supabase.from("build_tasks").select("id,title,status").eq("run_id", runId).eq("status", "running").order("sequence_order", { ascending: true }).limit(1);
  if (runningResult.error) throw new Error(runningResult.error.message);
  const runningTask = (runningResult.data as TaskRow[])[0];
  if (runningTask) return { status: "processing" as const, runId, taskId: runningTask.id, taskTitle: runningTask.title };

  const taskResult = await supabase.from("build_tasks").select("id,title,description,assigned_agent_version_id,sequence_order,status,task_key,attempt_count").eq("run_id", runId).eq("status", "pending").order("sequence_order", { ascending: true }).limit(1);
  if (taskResult.error) throw new Error(taskResult.error.message);
  const task = (taskResult.data as TaskRow[])[0];
  if (!task) {
    await supabase.from("project_runs").update({ status: "success" }).eq("id", runId);
    await supabase.from("projects").update({ status: "testing" }).eq("id", run.project_id);
    return { status: "complete" as const, runId };
  }

  const entitlementResult = await supabase.rpc("get_workspace_entitlement_v2", { p_workspace_id: workspaceId });
  if (entitlementResult.error) throw new Error(entitlementResult.error.message);
  const entitlement = (entitlementResult.data as Array<{ can_build?: boolean; reason?: string }> | null)?.[0];
  if (!entitlement?.can_build) {
    const limitReached = entitlement?.reason === "monthly_agent_action_limit_reached" || entitlement?.reason === "trial_agent_action_limit_reached";
    throw new Error(limitReached
      ? "This workspace has used all agent actions included in the current period. Upgrade or wait for renewal."
      : "Agent access is paused. Choose a paid plan to continue this build.");
  }

  const approvalResult = await supabase.from("approval_queue").select("id,risk_level,requested_capability,status").eq("task_id", task.id).eq("status", "pending").maybeSingle();
  if (approvalResult.error) throw new Error(approvalResult.error.message);
  const approval = approvalResult.data as { id: string; risk_level: string; requested_capability: string } | null;
  if (approval) {
    await supabase.from("project_runs").update({ status: "blocked_by_approval" }).eq("id", runId);
    return { status: "approval_required" as const, runId, task, approval };
  }

  async function claimTask() {
    const claimResult = await supabase.rpc("claim_app_factory_task", {
      p_workspace_id: workspaceId,
      p_run_id: runId,
      p_task_id: task.id,
    });
    if (claimResult.error) throw new Error(claimResult.error.message);
    if (!Array.isArray(claimResult.data) || claimResult.data.length !== 1) {
      throw new Error("This task was already claimed by another execution request. Refresh the run before continuing.");
    }
  }


  const repository = taskMatches(task, "build", /build and connect/i) ? await getWorkspaceGitHubRepository(workspaceId) : null;

  if (taskMatches(task, "handoff", /prepare release handoff/i)) {
    await claimTask();
    await supabase.from("build_tasks").update({ output_logs: "Creating an approved Vercel preview." }).eq("id", task.id);
    await supabase.from("project_runs").update({ status: "processing" }).eq("id", runId);
    try {
      const preview = await deployWorkspacePreview(workspaceId, runId);
      const output = `Preview deployment created from ${preview.branch}.\n${preview.previewUrl}\nVercel status: ${preview.readyState}`;
      const resultPayload = {
        kind: "preview_deployment",
        deploymentId: preview.deploymentId,
        previewUrl: preview.previewUrl,
        readyState: preview.readyState,
        branch: preview.branch,
      };
      await supabase.from("build_tasks").update({ status: "completed", output_logs: output, result_payload: resultPayload, completed_at: new Date().toISOString(), last_error: null }).eq("id", task.id);
      await supabase.rpc("record_workspace_usage", {
        p_workspace_id: workspaceId,
        p_usage_type: "agent_execution",
        p_units: 1,
        p_source_id: task.id,
        p_note: `Vercel Deployment Manager completed ${task.title}.`,
      });
      return {
        status: "task_completed" as const,
        runId,
        taskId: task.id,
        taskTitle: task.title,
        agentName: "Vercel Deployment Manager",
        output,
        deliverable: resultPayload,
        routedTo: "vercel" as const,
      };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to create the Vercel preview.";
      await supabase.from("build_tasks").update({ status: "pending", output_logs: `Last attempt failed: ${message}`, last_error: message }).eq("id", task.id);
      await supabase.from("project_runs").update({ status: "processing" }).eq("id", runId);
      return { status: "failed" as const, runId, taskId: task.id, message };
    }
  }

  if (taskMatches(task, "publish", /promote approved preview to production/i)) {
    const previewResult = await supabase
      .from("build_tasks")
      .select("result_payload")
      .eq("run_id", runId)
      .eq("task_key", "handoff")
      .maybeSingle();
    if (previewResult.error) throw new Error(previewResult.error.message);
    const previewPayload = (previewResult.data as { result_payload?: Record<string, unknown> } | null)?.result_payload;
    const deploymentId = typeof previewPayload?.deploymentId === "string" ? previewPayload.deploymentId : "";
    const previewUrl = typeof previewPayload?.previewUrl === "string" ? previewPayload.previewUrl : "";
    if (!deploymentId || !previewUrl) throw new Error("A completed preview deployment is required before production promotion.");

    await claimTask();
    try {
      const production = await promoteWorkspacePreview({ workspaceId, deploymentId, previewUrl });
      const output = `Production promotion completed.\n${production.productionUrl}`;
      const resultPayload = { kind: "production_deployment", ...production };
      await supabase.from("build_tasks").update({ status: "completed", output_logs: output, result_payload: resultPayload, completed_at: new Date().toISOString(), last_error: null }).eq("id", task.id);
      await supabase.from("projects").update({ status: "deployed" }).eq("id", run.project_id);
      await supabase.from("project_runs").update({ status: "success" }).eq("id", runId);
      await supabase.rpc("record_workspace_usage", {
        p_workspace_id: workspaceId,
        p_usage_type: "agent_execution",
        p_units: 1,
        p_source_id: task.id,
        p_note: `Vercel Deployment Manager completed ${task.title}.`,
      });
      return {
        status: "complete" as const,
        runId,
        taskId: task.id,
        taskTitle: task.title,
        agentName: "Vercel Deployment Manager",
        output,
        deliverable: resultPayload,
        routedTo: "vercel" as const,
      };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to promote the preview to production.";
      await supabase.from("build_tasks").update({ status: "pending", output_logs: `Last attempt failed: ${message}`, last_error: message }).eq("id", task.id);
      return { status: "failed" as const, runId, taskId: task.id, message };
    }
  }

  const providersResult = await supabase.from("workspace_model_keys").select("provider").eq("workspace_id", workspaceId).order("provider", { ascending: true }).limit(3);
  if (providersResult.error) throw new Error(providersResult.error.message);
  const preferredProviders = ((providersResult.data as Array<{ provider: "claude" | "openai" | "gemini" }>).map((row) => row.provider))
    .filter((provider): provider is "claude" | "openai" => provider === "claude" || provider === "openai");
  if (!preferredProviders.length) throw new Error("Connect your own Claude or OpenAI API key before running agents.");

  assertPrivilegedAppFactoryContext({
    authenticatedUserId,
    workspaceId,
    runWorkspaceId: run.workspace_id,
    runId,
    protectedAgentVersionId: task.assigned_agent_version_id,
  });

  const [projectResult, historyResult, versionResult] = await Promise.all([
    supabase.from("projects").select("name,description").eq("id", run.project_id).maybeSingle(),
    supabase.from("build_tasks").select("title,output_logs,sequence_order,status").eq("run_id", runId).eq("status", "completed").order("sequence_order", { ascending: true }).limit(8),
    createSupabaseAdminClient().from("seed_versions").select("content").eq("id", task.assigned_agent_version_id).maybeSingle(),
  ]);
  if (projectResult.error) throw new Error(projectResult.error.message);
  if (historyResult.error) throw new Error(historyResult.error.message);
  if (versionResult.error) throw new Error(versionResult.error.message);

  const project = projectResult.data as { name: string; description: string | null } | null;
  const version = versionResult.data as { content?: { body?: string; name?: string; description?: string } } | null;
  const agentName = version?.content?.name ?? "Pomebrain specialist agent";
  const agentPrompt = version?.content?.body ?? version?.content?.description;
  if (!agentPrompt) throw new Error("The protected agent version is missing its execution instructions.");

  const history = (historyResult.data as TaskRow[])
    .map((item) => `${item.title}: ${(item.output_logs ?? "").slice(0, 1800)}`)
    .join("\n\n")
    .slice(0, 7000);

  await claimTask();
  await supabase.from("project_runs").update({ status: "processing" }).eq("id", runId);
  await supabase.from("projects").update({ status: "building" }).eq("id", run.project_id);

  const result = await executeModelRouterCapability({
    capabilityId: "llm.cross_route",
    payload: {
      preferredProviders,
      taskClass: taskClass(task.title),
      complexity: /orchestrat|architect|security|deploy/i.test(task.title) ? "high" : "medium",
      systemPrompt: repository
        ? `${agentPrompt.slice(0, 5600)}\n\nYou are executing the governed repository build task. Return ONLY valid JSON with this exact shape: {"summary":"short summary","files":[{"path":"relative/path","content":"complete file contents"}]}. Build a coherent, runnable MVP based on the approved architecture and earlier work. Include all essential source and configuration files, but never include secrets, .env files, lockfiles, generated files, binaries, or markdown fences. Maximum 40 files and 500 KB total.`
        : `${agentPrompt.slice(0, 6800)}\n\nYou are executing one governed Pomebrain build task. Return a concrete, implementation-ready artifact. Do not claim to have changed external systems. Clearly identify files, decisions, checks, and any required approval.`,
      input: `PROJECT\n${project?.name ?? "Pomebrain build"}\n${project?.description ?? ""}\n\nCURRENT TASK\n${task.title}\n${task.description ?? ""}\n\nCOMPLETED WORK\n${history || "No earlier task output."}`,
      maxOutputTokens: 4096,
    },
    metadata: {
      triggeredByAgent: agentName,
      associatedPodId: `run:${runId}`,
      workspaceId,
    },
  });

  if (result.status !== "completed") {
    const message = result.error.message;
    await supabase.from("build_tasks").update({ status: "pending", output_logs: `Last attempt failed: ${message}`, last_error: message }).eq("id", task.id);
    await supabase.from("project_runs").update({ status: "processing" }).eq("id", runId);
    return { status: "failed" as const, runId, taskId: task.id, message };
  }

  let output = result.text;
  if (repository) {
    try {
      const manifest = parseRepositoryManifest(result.text);
      const committed = await commitFilesToWorkspaceRepository({
        workspaceId,
        runId,
        files: manifest.files,
        message: `Pomebrain build: ${project?.name ?? task.title}`,
      });
      output = `${manifest.summary}\n\nCommitted ${committed.fileCount} files to ${committed.owner}/${committed.repo} on ${committed.branch}.\n${committed.commitUrl}`;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to commit generated files to GitHub.";
      await supabase.from("build_tasks").update({ status: "pending", output_logs: `Last attempt failed: ${message}`, last_error: message }).eq("id", task.id);
      await supabase.from("project_runs").update({ status: "processing" }).eq("id", runId);
      return { status: "failed" as const, runId, taskId: task.id, message };
    }
  }

  await supabase.from("build_tasks").update({ status: "completed", output_logs: output, completed_at: new Date().toISOString(), last_error: null }).eq("id", task.id);
  await supabase.rpc("record_workspace_usage", {
    p_workspace_id: workspaceId,
    p_usage_type: "agent_execution",
    p_units: 1,
    p_source_id: task.id,
    p_note: `${agentName} completed ${task.title}.`,
  });

  return {
    status: "task_completed" as const,
    runId,
    taskId: task.id,
    taskTitle: task.title,
    agentName,
    output,
    routedTo: result.routedTo,
  };
}
