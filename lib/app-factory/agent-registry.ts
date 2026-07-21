import { normalizeRoleKey } from "@/lib/app-factory/utils";

export const agentNameToSlug: Record<string, string> = {
  "Analytical Pipeline Builder": "analytical-pipeline-builder",
  "API Token Cost Guard": "api-token-cost-guard",
  "Brief Synthesizer": "brief-synthesizer",
  "Competitor Feature Scraper": "competitor-feature-scraper",
  "Database Schema Provisioner": "database-schema-provisioner",
  "Deep Prompt Sanitizer & Guard": "deep-prompt-sanitizer-guard",
  "Dynamic Meta-Learner": "dynamic-meta-learner",
  "Git Merge Orchestrator": "git-merge-orchestrator",
  "Logic Reconciliation Engine": "logic-reconciliation-engine",
  "NextJS Boilerplate Architect": "nextjs-boilerplate-architect",
  "Notion Document Synchronizer": "notion-document-synchronizer",
  "pgvector Vectorizing Engine": "pgvector-vectorizing-engine",
  "Playwright E2E Tester": "playwright-e2e-tester",
  "Pomebrain Architect Orchestrator": "pomebrain-architect-orchestrator",
  "Slack Incident Communicator": "slack-incident-communicator",
  "Supabase RLS Guard": "supabase-rls-guard",
  "Tech-Stack Evaluation Analyst": "tech-stack-evaluation-analyst",
  "Token Throttle Controller": "token-throttle-controller",
  "Vercel Deployment Manager": "vercel-deployment-manager",
};

const normalizedAgentNameToSlug = new Map(
  Object.entries(agentNameToSlug).map(([name, slug]) => [normalizeRoleKey(name), slug]),
);

export function agentSlugForName(agentName: string) {
  return (
    normalizedAgentNameToSlug.get(normalizeRoleKey(agentName)) ??
    agentName
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}
