"use client";

import { useState } from "react";
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
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createCrownPlan } from "@/lib/crown-planner";
import type { CrownRun } from "@/lib/domain";

type CrownConsoleProps = {
  onOpenBrain: () => void;
  userEmail?: string;
  workspaceId?: string;
};

const suggestions = [
  "Build a client onboarding portal for a finance team",
  "Create an analytics dashboard for a growing SaaS company",
  "Design a mobile app that helps teams capture field notes",
];

export function CrownConsole({ onOpenBrain, userEmail = "Unknown user", workspaceId = "missing workspace_id" }: CrownConsoleProps) {
  const [goal, setGoal] = useState("");
  const [run, setRun] = useState<CrownRun | null>(null);
  const [error, setError] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);
  const [approved, setApproved] = useState(false);

  const runCrown = () => {
    setError("");
    setApproved(false);
    setIsPlanning(true);

    window.setTimeout(() => {
      try {
        setRun(createCrownPlan(goal));
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
    setError("");
    setGoal("");
  };

  return (
    <div className="view-scroll crown-page">
      <section className="console-hero">
        <div className="console-orbit orbit-one" />
        <div className="console-orbit orbit-two" />
        <div className="console-content">
          <span className="eyebrow crown-eyebrow"><span /> CROWN CONSOLE · LIVE PLANNER</span>
          <h1>Tell the brain what<br />you want to <em>build.</em></h1>
          <p>One goal is enough. The Crown searches the Brain, assembles the right agents and skills, then returns a build plan for your approval.</p>

          <div className="console-footnote" style={{ justifyContent: "flex-start", margin: "18px 0" }}>
            <span>Signed in: {userEmail}</span>
            <span>Workspace: {workspaceId}</span>
            <form action="/auth/signout" method="post">
              <button type="submit">Sign out</button>
            </form>
          </div>

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
              <div className="model-select" title="This preview plans with local logic. Live runs route through llm.cross_route to Claude or OpenAI by task complexity.">
                <span className="model-mark">P</span>
                Pomebrain routing
                <ChevronDown size={14} />
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
            <p>Phase 0 demonstrates the routing and approval experience. Live workspace execution connects in the App Factory phase.</p>
          </div>
          <div className="process-grid">
            <article><span className="process-number">01</span><BrainCircuit size={22} /><strong>Search the Brain</strong><p>Find relevant approved agents, skills, evidence, and previous decisions.</p></article>
            <article><span className="process-number">02</span><Bot size={22} /><strong>Assemble agents</strong><p>Give each specialist a clear role, tools, boundaries, and expected output.</p></article>
            <article><span className="process-number">03</span><Diamond size={22} /><strong>Shape the plan</strong><p>Break the goal into sequenced work with visible dependencies and checks.</p></article>
            <article><span className="process-number">04</span><ShieldCheck size={22} /><strong>Ask permission</strong><p>Show what will happen before consequential tools or external systems are used.</p></article>
          </div>
        </section>
      ) : (
        <BuildPlan run={run} approved={approved} onApprove={() => setApproved(true)} onReset={reset} />
      )}

      <section className="console-footnote">
        <button type="button" onClick={onOpenBrain}><ArrowLeft size={15} /> See what the Brain knows</button>
        <span><LockKeyhole size={14} /> No external action runs without policy or approval</span>
      </section>
    </div>
  );
}

function BuildPlan({
  run,
  approved,
  onApprove,
  onReset,
}: {
  run: CrownRun;
  approved: boolean;
  onApprove: () => void;
  onReset: () => void;
}) {
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
        <div><span>STATUS</span><strong className={approved ? "approved-text" : "waiting-text"}>{approved ? "Plan approved" : "Awaiting approval"}</strong></div>
        <div><span>AGENTS ROUTED</span><strong>{run.agents.length}</strong></div>
        <div><span>SKILLS FOUND</span><strong>{run.skills.length}</strong></div>
        <div><span>ESTIMATED STAGES</span><strong>{run.steps.length}</strong></div>
      </div>

      <div className="plan-layout">
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

      <div className={`approval-gate${approved ? " gate-approved" : ""}`}>
        <span className="approval-icon">{approved ? <Check size={22} /> : <ShieldCheck size={22} />}</span>
        <div>
          <span>{approved ? "PLAN APPROVED" : "HUMAN CONFIRMATION GATE"}</span>
          <strong>{approved ? "The Crown is ready for the execution engine." : "Review the route before agents begin."}</strong>
          <p>{approved ? "Phase 0 has stored the approval locally. Controlled workspace execution will be wired in the App Factory phase." : "Approval records your intent. Phase 0 will not modify files or call external systems."}</p>
        </div>
        {approved ? (
          <span className="approved-seal"><Clock3 size={16} /> Execution arrives in App Factory</span>
        ) : (
          <button className="approve-button" type="button" onClick={onApprove}>Approve build plan <ArrowRight size={17} /></button>
        )}
      </div>
    </section>
  );
}
