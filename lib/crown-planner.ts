import { CrownGoalSchema, CrownRunSchema, type CrownRun } from "@/lib/domain";
import { planUniversalConnectors, type UniversalConnectorEnvironment } from "@/lib/connectors/universal-catalog";

const coreBuildAgents = [
  "Pomebrain Architect Orchestrator",
  "Deep Prompt Sanitizer & Guard",
  "Brief Synthesizer",
  "Token Throttle Controller",
  "NextJS Boilerplate Architect",
  "Git Merge Orchestrator",
  "Playwright E2E Tester",
];

function uniqueAgents(agents: string[]) {
  return Array.from(new Set(agents));
}

function selectSpecialists(goal: string) {
  const normalized = goal.toLowerCase();
  const specialists: string[] = [];

  if (/database|schema|supabase|auth|tenant|organization|account|invoice|finance|cash|bookkeeping|dashboard|data|analytics|report/.test(normalized)) {
    specialists.push("Database Schema Provisioner");
  }

  if (/token|cost|budget|run-rate|usage|pricing|provider|openai|claude/.test(normalized)) {
    specialists.push("API Token Cost Guard");
  }

  if (/embedding|vector|pgvector|semantic|knowledge|manual|documentation|docs|search|chunk/.test(normalized)) {
    specialists.push("pgvector Vectorizing Engine");
  }

  if (/analytics|funnel|retention|cohort|event|conversion|metric|dashboard|report/.test(normalized)) {
    specialists.push("Analytical Pipeline Builder");
  }

  if (/rls|security|tenant|supabase|auth|permission|policy|private|multi-tenant/.test(normalized)) {
    specialists.push("Supabase RLS Guard");
  }

  if (/prompt injection|sanitize|sanitizer|malicious|hidden instruction|untrusted|scraped|uploaded|external input/.test(normalized)) {
    specialists.push("Deep Prompt Sanitizer & Guard");
  }

  if (/throttle|quota|recursive|runaway|token limit|token cutoff|session quota/.test(normalized)) {
    specialists.push("Token Throttle Controller");
  }

  if (/deploy|vercel|preview|production|launch|live/.test(normalized)) {
    specialists.push("Vercel Deployment Manager");
  }

  if (/slack|alert|incident|notify|notification|approval trigger|status update/.test(normalized)) {
    specialists.push("Slack Incident Communicator");
  }

  if (/notion|wiki|document|documentation|spec|architecture note|knowledge page/.test(normalized)) {
    specialists.push("Notion Document Synchronizer");
  }

  if (/competitor|market|pricing model|alternative|feature gap|marketplace/.test(normalized)) {
    specialists.push("Competitor Feature Scraper");
  }

  if (/dependency|npm|pip|package|library|license|vulnerability|tech stack|open-source|opensource/.test(normalized)) {
    specialists.push("Tech-Stack Evaluation Analyst");
  }

  if (/learn|meta|skill|agent manifest|template|reusable|foundry|distill/.test(normalized)) {
    specialists.push("Dynamic Meta-Learner");
  }

  if (/conflict|duplicate|overlap|version|supersede|reconcile|consensus|ingest|ingestion/.test(normalized)) {
    specialists.push("Logic Reconciliation Engine");
  }

  return specialists;
}

function selectSkills(goal: string) {
  const normalized = goal.toLowerCase();
  const skills = [
    "Recursive Task Resolution Loop",
    "App Brief Decomposition",
    "Next.js App Router Architecture Template",
    "Type-Safe Zod Validator Scaffolding",
    "Playwright E2E Form Scripting",
  ];

  if (/rls|security|tenant|supabase|auth|permission|policy|private|multi-tenant/.test(normalized)) {
    skills.push("Multi-Tenant RLS Generation");
  }

  if (/conflict|duplicate|overlap|version|supersede|reconcile|consensus|ingest|ingestion/.test(normalized)) {
    skills.push("Semantic Contradiction Reconciliation");
  }

  return uniqueAgents(skills);
}

function createTitle(goal: string) {
  const clean = goal.replace(/[.!?]+$/g, "").trim();
  const shortened = clean.length > 62 ? `${clean.slice(0, 59)}…` : clean;
  return shortened.charAt(0).toUpperCase() + shortened.slice(1);
}

export function createCrownPlan(rawGoal: string, env: UniversalConnectorEnvironment = {}): CrownRun {
  const { goal } = CrownGoalSchema.parse({ goal: rawGoal });
  const specialists = selectSpecialists(goal);
  const skills = selectSkills(goal);
  const architectureAgent = specialists[0] ?? "NextJS Boilerplate Architect";
  const deploymentAgent = specialists.includes("Vercel Deployment Manager") ? "Vercel Deployment Manager" : "Git Merge Orchestrator";
  const createdAt = new Date().toISOString();

  return CrownRunSchema.parse({
    id: `run-${Date.now()}`,
    goal,
    title: createTitle(goal),
    createdAt,
    status: "awaiting_approval",
    agents: uniqueAgents(["Pomebrain Architect Orchestrator", "Brief Synthesizer", ...specialists, ...coreBuildAgents]),
    skills,
    connectorPlan: planUniversalConnectors(goal, env),
    approvalRequired: true,
    steps: [
      {
        id: "orchestrate",
        title: "Control the build loop",
        detail: "Read project graph state, order dependencies, assign agents, and preserve continuity checkpoints.",
        agent: "Pomebrain Architect Orchestrator",
        status: "ready",
      },
      {
        id: "understand",
        title: "Sanitize and shape the build brief",
        detail: "Clean untrusted inputs, then clarify the audience, desired outcome, constraints, and definition of done.",
        agent: "Deep Prompt Sanitizer & Guard",
        status: "ready",
      },
      {
        id: "retrieve",
        title: "Gather the right seeds",
        detail: "Retrieve approved patterns, skills, decisions, and lessons from the Brain while enforcing token quota guards.",
        agent: "Token Throttle Controller",
        status: "ready",
      },
      {
        id: "architect",
        title: "Design the system",
        detail: "Choose the product structure, data model, interfaces, and delivery path.",
        agent: architectureAgent,
        status: "queued",
      },
      {
        id: "build",
        title: "Build and connect",
        detail: "Create the experience and implementation in a controlled project workspace.",
        agent: "NextJS Boilerplate Architect",
        status: "queued",
      },
      {
        id: "verify",
        title: "Review implementation and test plan",
        detail: "Review the generated files, define executable checks, record evidence, and flag anything that must be fixed before release.",
        agent: "Playwright E2E Tester",
        status: "approval",
      },
      {
        id: "handoff",
        title: "Prepare release handoff",
        detail: "Create an isolated Vercel preview from the governed build branch and return its review URL.",
        agent: deploymentAgent,
        status: "approval",
      },
      {
        id: "publish",
        title: "Promote approved preview to production",
        detail: "Promote the reviewed preview only after a separate owner confirmation and record the production result.",
        agent: "Vercel Deployment Manager",
        status: "approval",
      },
    ],
  });
}
