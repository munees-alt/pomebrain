"use client";

import { startTransition, useEffect, useOptimistic, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  Clock3,
  Crown,
  Diamond,
  LoaderCircle,
  LockKeyhole,
  PlugZap,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createCrownPlan } from "@/lib/crown-planner";
import type { CrownRun } from "@/lib/domain";
import { BillingPlans } from "@/components/billing-plans";

type CrownConsoleProps = {
  canOpenBrain?: boolean;
  onOpenBrain: () => void;
};

type WorkspaceEntitlement = {
  plan_slug: string;
  status: string;
  trial_ends_at: string | null;
  days_remaining: number | null;
  can_build: boolean;
  reason: string;
  monthly_build_limit: number | null;
  monthly_agent_execution_limit: number | null;
  builds_used: number;
  agent_executions_used: number;
  current_period_ends_at: string | null;
  cancel_at_period_end: boolean;
  has_billing_account: boolean;
};

type RoutingMode = "pomebrain" | "google_workspace" | "plan_only";

const routingOptions: Array<{
  id: RoutingMode;
  label: string;
  detail: string;
  env?: "google";
}> = [
  {
    id: "pomebrain",
    label: "Pomebrain routing",
    detail: "Agents choose the best connected stack.",
  },
  {
    id: "google_workspace",
    label: "Design with Google",
    detail: "Prefer Drive, Sheets, Gmail, and Workspace docs when useful.",
    env: "google",
  },
  {
    id: "plan_only",
    label: "Plan only",
    detail: "Return the governed plan without connector preference.",
  },
];

const suggestions = [
  "Build a client onboarding portal for a finance team",
  "Create an analytics dashboard for a growing SaaS company",
  "Design a mobile app that helps teams capture field notes",
];

export function CrownConsole({ canOpenBrain = false, onOpenBrain }: CrownConsoleProps) {
  const [goal, setGoal] = useState("");
  const [run, setRun] = useState<CrownRun | null>(null);
  const [error, setError] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [approvalError, setApprovalError] = useState("");
  const [entitlement, setEntitlement] = useState<WorkspaceEntitlement | null>(null);
  const [routingMode, setRoutingMode] = useState<RoutingMode>("pomebrain");
  const [routingOpen, setRoutingOpen] = useState(false);
  const [googleConnectorReady, setGoogleConnectorReady] = useState(false);
  const [persistedRun, setPersistedRun] = useState<{
    projectId: string;
    runId: string;
    status: string;
    taskCount: number;
    approvalCount: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function resumeActiveRun() {
      try {
        const response = await fetch("/api/app-factory/runs", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          active?: {
            run: CrownRun;
            persisted: { projectId: string; runId: string; status: string; taskCount: number; approvalCount: number };
          } | null;
        };
        if (!mounted || !payload.active) return;
        setRun(payload.active.run);
        setPersistedRun(payload.active.persisted);
        setApproved(true);
      } catch {
        // Starting a new goal remains available if no resumable run can be loaded.
      }
    }
    void resumeActiveRun();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadEntitlement() {
      try {
        const response = await fetch("/api/billing/entitlement", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { entitlement?: WorkspaceEntitlement | null };
        if (mounted) setEntitlement(payload.entitlement ?? null);
      } catch {
        // The server still enforces entitlement; this display call is best-effort.
      }
    }

    void loadEntitlement();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadHealth() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { environment?: { google?: boolean } };
        if (mounted) setGoogleConnectorReady(Boolean(payload.environment?.google));
      } catch {
        // Routing still works without this display hint.
      }
    }

    void loadHealth();
    return () => {
      mounted = false;
    };
  }, []);

  const runCrown = () => {
    setError("");
    setApproved(false);
    setApprovalError("");
    setPersistedRun(null);
    setIsPlanning(true);

    window.setTimeout(() => {
      try {
        setRun(createCrownPlan(goal, { google: routingMode === "google_workspace" && googleConnectorReady }));
      } catch (cause) {
        setRun(null);
        setError(cause instanceof Error ? cause.message : "The goal needs a little more detail.");
      } finally {
        setIsPlanning(false);
      }
    }, 650);
  };

  const reset = () => {
    setRun(null);
    setApproved(false);
    setApprovalError("");
    setPersistedRun(null);
    setError("");
    setGoal("");
  };

  const selectedRouting = routingOptions.find((option) => option.id === routingMode) ?? routingOptions[0];

  const approveRun = async () => {
    if (!run) return;

    setIsApproving(true);
    setApprovalError("");

    try {
      const response = await fetch("/api/app-factory/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: run.goal }),
      });
      const payload = (await response.json()) as {
        persisted?: {
          projectId: string;
          runId: string;
          status: string;
          taskCount: number;
          approvalCount: number;
        };
        error?: string;
      };

      if (!response.ok || !payload.persisted) {
        throw new Error(payload.error ?? "Unable to start the App Factory run.");
      }

      setPersistedRun(payload.persisted);
      setApproved(true);
    } catch (cause) {
      setApprovalError(cause instanceof Error ? cause.message : "Unable to start the App Factory run.");
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="view-scroll crown-page">
      <section className="console-hero">
        <div className="console-orbit orbit-one" />
        <div className="console-orbit orbit-two" />
        <div className="console-content">
          <span className="eyebrow crown-eyebrow"><span /> CROWN CONSOLE · AGENT BUILD SYSTEM</span>
          <h1>Tell Pomebrain what<br />you want to <em>build.</em></h1>
          <p>One goal is enough. Crown chooses the right protected agents and connector capabilities, then returns a build plan for your approval.</p>

          {entitlement ? (
            <div className={`trial-banner${entitlement.can_build ? "" : " trial-ended"}`}>
              <span>{entitlement.can_build ? "AGENT ACCESS ACTIVE" : "AGENT ACCESS PAUSED"}</span>
              <strong>
                {entitlement.status === "trialing"
                  ? `${entitlement.days_remaining ?? 0} day${entitlement.days_remaining === 1 ? "" : "s"} left in your free agent-build trial`
                  : entitlement.can_build
                    ? "Paid agent access is active"
                    : "Monthly plan required to build with agents"}
              </strong>
              <p>First month includes all 19 protected agents and 200 agent actions. Crown planning stays unlimited; model usage runs on your own API keys.</p>
              {!entitlement.can_build ? <a href="#plans">View agent plans <ArrowRight size={13} /></a> : null}
            </div>
          ) : null}

          <div className={`goal-composer${error ? " composer-error" : ""}`}>
            <div className="composer-label">
              <Crown size={15} /> YOUR GOAL
              <span>Natural language</span>
            </div>
            <textarea
              value={goal}
              onChange={(event) => {
                setGoal(event.target.value);
                setError("");
              }}
              placeholder="e.g. Build a client onboarding portal that collects documents, tracks milestones, and keeps the finance team informed…"
              rows={4}
              maxLength={1200}
              aria-label="What do you want Pomebrain to build?"
            />
            <div className="composer-footer">
              <div className="routing-menu-wrap">
                <button
                  className="model-select"
                  type="button"
                  title="Choose how Crown should route this goal."
                  aria-expanded={routingOpen}
                  aria-haspopup="menu"
                  onClick={() => setRoutingOpen((open) => !open)}
                >
                  <span className="model-mark">{routingMode === "google_workspace" ? "G" : "P"}</span>
                  {selectedRouting.label}
                  <ChevronDown size={14} />
                </button>
                {routingOpen ? (
                  <div className="routing-menu" role="menu">
                    {routingOptions.map((option) => {
                      const disabled = option.env === "google" && !googleConnectorReady;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={routingMode === option.id}
                          disabled={disabled}
                          className={routingMode === option.id ? "active" : ""}
                          onClick={() => {
                            if (disabled) return;
                            setRoutingMode(option.id);
                            setRoutingOpen(false);
                          }}
                        >
                          <strong>{option.label}</strong>
                          <span>{disabled ? "Connect Google first in Connectors." : option.detail}</span>
                        </button>
                      );
                    })}
                    {!googleConnectorReady ? <a href="/api/connectors/google/start">Connect Google Workspace</a> : null}
                  </div>
                ) : null}
              </div>
              <span className="char-count">{goal.length}/1200</span>
              <button className="run-crown" type="button" onClick={runCrown} disabled={isPlanning}>
                {isPlanning ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
                {isPlanning ? "Planning…" : "Run the Crown"}
                {!isPlanning && <ArrowRight size={18} />}
              </button>
            </div>
          </div>
          {error && <p className="goal-error">Give the Crown a little more detail—what should be built, for whom, and why?</p>}

          {!run && (
            <div className="suggestion-row">
              <span>TRY A GOAL</span>
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => setGoal(suggestion)}>
                  {suggestion.replace(/^Build |^Create |^Design /, "")}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {!run ? (
        <section className="crown-explainer">
          <div className="process-heading">
            <span className="section-label">HOW THE CROWN THINKS</span>
            <h2>One goal. A governed build team.</h2>
            <p>Crown assembles the right specialists, prepares the work, and keeps every consequential action behind your approval.</p>
          </div>
          <div className="process-grid">
            <article><span className="process-number">01</span><BrainCircuit size={22} /><strong>Match protected agents</strong><p>Find relevant approved agents, skills, evidence, and previous decisions.</p></article>
            <article><span className="process-number">02</span><Bot size={22} /><strong>Assemble agents</strong><p>Give each specialist a clear role, tools, boundaries, and expected output.</p></article>
            <article><span className="process-number">03</span><Diamond size={22} /><strong>Shape the plan</strong><p>Break the goal into sequenced work with visible dependencies and checks.</p></article>
            <article><span className="process-number">04</span><ShieldCheck size={22} /><strong>Ask permission</strong><p>Show what will happen before consequential tools or external systems are used.</p></article>
          </div>
        </section>
      ) : (
        <BuildPlan
          run={run}
          approved={approved}
          approvalError={approvalError}
          isApproving={isApproving}
          persistedRun={persistedRun}
          onApprove={approveRun}
          onReset={reset}
        />
      )}

      <BillingPlans entitlement={entitlement} />

      <section className="console-footnote">
        {canOpenBrain ? <button type="button" onClick={onOpenBrain}><ArrowLeft size={15} /> See what the Brain knows</button> : null}
        <span><LockKeyhole size={14} /> No external action runs without policy or approval</span>
      </section>
    </div>
  );
}

function BuildPlan({
  run,
  approved,
  approvalError,
  isApproving,
  persistedRun,
  onApprove,
  onReset,
}: {
  run: CrownRun;
  approved: boolean;
  approvalError: string;
  isApproving: boolean;
  persistedRun: {
    projectId: string;
    runId: string;
    status: string;
    taskCount: number;
    approvalCount: number;
  } | null;
  onApprove: () => void;
  onReset: () => void;
}) {
  type RunnerState = {
    status: "idle" | "processing" | "approving" | "task_completed" | "approval_required" | "complete" | "failed";
    taskTitle?: string;
    agentName?: string;
    output?: string;
    approval?: { id: string; requested_capability: string; risk_level: string };
    deliverable?: Record<string, unknown>;
  };

  const [runnerBusy, setRunnerBusy] = useState(false);
  const [runnerError, setRunnerError] = useState("");
  const [runnerState, setRunnerState] = useState<RunnerState>({ status: "idle" });
  const [deliverables, setDeliverables] = useState<Record<string, unknown>[]>([]);
  const [optimisticRunnerState, showOptimisticRunnerState] = useOptimistic(
    runnerState,
    (_current, next: RunnerState) => next,
  );

  async function refreshRunState() {
    if (!persistedRun) return;
    const response = await fetch(`/api/app-factory/runs/${persistedRun.runId}`, { cache: "no-store" });
    const payload = (await response.json()) as { runnerState?: RunnerState; deliverables?: Record<string, unknown>[]; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Unable to refresh this build.");
    if (payload.runnerState) setRunnerState(payload.runnerState);
    setDeliverables(payload.deliverables ?? []);
  }

  useEffect(() => {
    if (!persistedRun) return;
    const timer = window.setTimeout(() => {
      void refreshRunState().catch((cause) => {
        setRunnerError(cause instanceof Error ? cause.message : "Unable to restore this build.");
      });
    }, 0);
    return () => window.clearTimeout(timer);
    // The run ID is the durable identity; refresh when a different run is restored or created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistedRun?.runId]);

  useEffect(() => {
    if (runnerState.status !== "processing" || !persistedRun) return;
    const timer = window.setInterval(() => {
      void refreshRunState().catch(() => {
        // Keep the last durable state and try again on the next polling interval.
      });
    }, 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runnerState.status, persistedRun?.runId]);

  function runNextAgent() {
    if (!persistedRun) return;
    setRunnerBusy(true);
    setRunnerError("");
    startTransition(async () => {
      showOptimisticRunnerState({ ...runnerState, status: "processing" });
      try {
        const response = await fetch(`/api/app-factory/runs/${persistedRun.runId}/next`, { method: "POST" });
        const payload = (await response.json()) as typeof runnerState & { error?: string };
        if (!response.ok && response.status !== 202) throw new Error(payload.error ?? "Unable to run the next agent action.");
        setRunnerState(payload);
        if (payload.deliverable) setDeliverables((current) => [...current.filter((item) => item.kind !== payload.deliverable?.kind), payload.deliverable!]);
      } catch (cause) {
        setRunnerError(cause instanceof Error ? cause.message : "Unable to run the next agent action.");
      } finally {
        setRunnerBusy(false);
      }
    });
  }

  function approveGate() {
    if (!runnerState.approval) return;
    setRunnerBusy(true);
    setRunnerError("");
    startTransition(async () => {
      showOptimisticRunnerState({ ...runnerState, status: "approving" });
      try {
        const response = await fetch(`/api/app-factory/approvals/${runnerState.approval!.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "approved" }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Unable to approve this action.");
        await refreshRunState();
      } catch (cause) {
        setRunnerError(cause instanceof Error ? cause.message : "Unable to approve this action.");
      } finally {
        setRunnerBusy(false);
      }
    });
  }

  return (
    <section className="build-plan" aria-live="polite">
      <div className="plan-heading">
        <div>
          <span className="section-label">CROWN BUILD MAP</span>
          <h2>{run.title}</h2>
          <p>{run.goal}</p>
        </div>
        <button className="reset-plan" onClick={onReset} type="button"><RotateCcw size={15} /> New goal</button>
      </div>

      <div className="plan-overview">
        <div><span>STATUS</span><strong className={approved ? "approved-text" : "waiting-text"}>{approved ? "Agent work ready" : "Awaiting approval"}</strong></div>
        <div><span>AGENTS ROUTED</span><strong>{run.agents.length}</strong></div>
        <div><span>SKILLS FOUND</span><strong>{run.skills.length}</strong></div>
        <div><span>{persistedRun ? "TASKS STORED" : "ESTIMATED STAGES"}</span><strong>{persistedRun?.taskCount ?? run.steps.length}</strong></div>
      </div>

      <div className="plan-layout bento-board">
        <div className="agent-team panel-card">
          <span className="section-label">ASSEMBLED TEAM</span>
          <div className="agent-stack">
            {run.agents.map((agent, index) => (
              <article key={agent}>
                <span className={`agent-avatar agent-${index + 1}`}>{agent.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
                <div><strong>{agent}</strong><span>{index === 0 ? "Leads the brief" : index === run.agents.length - 1 ? "Verifies the outcome" : "Executes specialist work"}</span></div>
                <Check size={15} />
              </article>
            ))}
          </div>
          <span className="section-label skill-label">RETRIEVED SKILLS</span>
          <div className="skill-chips">{run.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
        </div>

        <div className="execution-plan panel-card">
          <span className="section-label">EXECUTION PLAN</span>
          <div className="step-list">
            {run.steps.map((step, index) => (
              <article key={step.id}>
                <span className="step-index">{String(index + 1).padStart(2, "0")}</span>
                <div className="step-copy"><strong>{step.title}</strong><p>{step.detail}</p><span><Bot size={12} /> {step.agent}</span></div>
                <span className={`step-status step-${step.status}`}>{step.status}</span>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="panel-card universal-plan-card">
        <div className="panel-heading">
          <div><span className="section-label">UNIVERSAL CONNECTOR PLAN</span><h2>Tools chosen by requirement</h2></div>
          <div className="graph-legend"><PlugZap size={14} /> Connector-agnostic build</div>
        </div>
        <div className="universal-plan-grid">
          {run.connectorPlan.map((requirement) => (
            <article key={requirement.requirement} className="universal-plan-row">
              <div>
                <span>{requirement.label}</span>
                <strong>{requirement.reason}</strong>
              </div>
              <div className="connector-candidate-list">
                {requirement.candidates.map((candidate) => (
                  <span key={`${requirement.requirement}-${candidate.connectorId}`} className={candidate.customerOwned ? "customer-owned" : ""}>
                    {candidate.title}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className={`approval-gate${approved ? " gate-approved" : ""}`}>
        <span className="approval-icon">{approved ? <Check size={22} /> : <ShieldCheck size={22} />}</span>
        <div>
          <span>{approved ? "APP FACTORY RUN CREATED" : "HUMAN CONFIRMATION GATE"}</span>
          <strong>{approved ? "The protected task queue is ready for controlled execution." : "Review the route before agents begin."}</strong>
          <p>
            {approved && persistedRun
              ? `Project ${persistedRun.projectId} has run ${persistedRun.runId}, ${persistedRun.taskCount} tasks, and ${persistedRun.approvalCount} pending gate(s).`
              : "Approval creates a real project, run, task backlog, and approval queue entry before any external action can happen."}
          </p>
          {approvalError && <p className="goal-error">{approvalError}</p>}
        </div>
        {approved ? (
          <span className="approved-seal"><Clock3 size={16} /> Ready to run agents</span>
        ) : (
          <button className="approve-button" type="button" onClick={onApprove} disabled={isApproving}>
            {isApproving && <LoaderCircle className="spin" size={17} />}
            {isApproving ? "Creating run" : "Approve build plan"}
            {!isApproving && <ArrowRight size={17} />}
          </button>
        )}
      </div>

      {approved && persistedRun ? (
        <div className="agent-runner panel-card">
          <div>
            <span className="section-label">LIVE AGENT EXECUTION</span>
            <h3>
              {optimisticRunnerState.status === "complete"
                ? "Task queue completed"
                : optimisticRunnerState.status === "approval_required"
                  ? "Your approval is required"
                  : optimisticRunnerState.status === "processing"
                    ? "Claiming the next protected task"
                    : optimisticRunnerState.status === "approving"
                      ? "Recording your approval"
                      : optimisticRunnerState.taskTitle ?? "Run the next protected agent action"}
            </h3>
            <p>
              {optimisticRunnerState.status === "approval_required"
                ? `${optimisticRunnerState.approval?.requested_capability ?? "This action"} is ${optimisticRunnerState.approval?.risk_level ?? "gated"}. Review it before work continues.`
                : optimisticRunnerState.status === "processing" || optimisticRunnerState.status === "approving"
                  ? "The interface has updated immediately; the server is confirming the durable state."
                  : optimisticRunnerState.agentName
                    ? `${optimisticRunnerState.agentName} completed this action using your connected model key.`
                  : "Each click advances one specialist task and records one agent action against your plan. External writes remain separately gated."}
            </p>
          </div>
          {optimisticRunnerState.output ? <pre>{optimisticRunnerState.output}</pre> : null}
          {deliverables.length ? (
            <div className="run-deliverables">
              {deliverables.map((deliverable) => {
                const kind = typeof deliverable.kind === "string" ? deliverable.kind : "delivery";
                const url = typeof deliverable.productionUrl === "string"
                  ? deliverable.productionUrl
                  : typeof deliverable.previewUrl === "string"
                    ? deliverable.previewUrl
                    : null;
                return url ? <a key={`${kind}-${url}`} href={url} target="_blank" rel="noreferrer">{kind === "production_deployment" ? "Open production app" : "Open preview"} <ArrowRight size={14} /></a> : null;
              })}
            </div>
          ) : null}
          {runnerError ? <p className="goal-error">{runnerError}</p> : null}
          {optimisticRunnerState.status === "approval_required" ? (
            <button type="button" onClick={() => void approveGate()} disabled={runnerBusy}>
              {runnerBusy ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />} Approve and continue
            </button>
          ) : optimisticRunnerState.status !== "complete" && optimisticRunnerState.status !== "processing" ? (
            <button type="button" onClick={() => void runNextAgent()} disabled={runnerBusy}>
              {runnerBusy ? <LoaderCircle className="spin" size={16} /> : <Bot size={16} />} {runnerBusy ? "Agent working" : optimisticRunnerState.status === "task_completed" ? "Run next agent" : "Start agent work"}
            </button>
          ) : null}
        </div>
      ) : null}

      {approved && persistedRun ? <AuditTimeline runId={persistedRun.runId} refreshKey={runnerState.status} /> : null}
    </section>
  );
}

type AuditEvent = {
  id: string;
  action_type: string;
  target_table: string;
  target_id: string;
  state_after: Record<string, unknown> | null;
  created_at: string;
};

function AuditTimeline({ runId, refreshKey }: { runId: string; refreshKey: string }) {
  const PAGE_SIZE = 12;
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    let mounted = true;
    async function loadActivity() {
      const response = await fetch(`/api/app-factory/runs/${runId}/activity`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { events?: AuditEvent[] };
      if (mounted) setEvents(payload.events ?? []);
    }
    void loadActivity();
    return () => { mounted = false; };
  }, [runId, refreshKey]);

  return (
    <div className="audit-timeline panel-card">
      <div className="audit-heading">
        <div><span className="section-label">IMMUTABLE AUDIT ACTIVITY</span><h3>Durable run history</h3></div>
        <span>{events.length} recent events</span>
      </div>
      {events.length ? (
        <div className="audit-event-list">
          {events.slice(0, visibleCount).map((event) => (
            <article key={event.id}>
              <span className="audit-event-dot" />
              <div><strong>{event.action_type.replaceAll("_", " ")}</strong><small>{event.target_table} · {event.target_id}</small></div>
              <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>
            </article>
          ))}
        </div>
      ) : <p className="audit-empty">Audit events appear here after the protected queue changes state.</p>}
      {visibleCount < events.length ? (
        <button type="button" className="audit-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Show older events</button>
      ) : null}
    </div>
  );
}
