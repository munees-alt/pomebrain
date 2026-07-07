import "server-only";

import type { CapabilityRequest } from "@/lib/mcp/capabilities";

type ModelTier = "fast" | "balanced" | "deep";
type Provider = "claude" | "openai" | "gemini";

type ModelOption = {
  provider: Provider;
  model: string;
  tier: ModelTier;
  apiKeyEnv: "ANTHROPIC_API_KEY" | "OPENAI_API_KEY" | "GOOGLE_API_KEY";
};

const MODEL_CATALOG: ModelOption[] = [
  { provider: "claude", tier: "fast", model: process.env.POMEBRAIN_CLAUDE_FAST_MODEL ?? "claude-haiku-4-5", apiKeyEnv: "ANTHROPIC_API_KEY" },
  { provider: "claude", tier: "balanced", model: process.env.POMEBRAIN_CLAUDE_BALANCED_MODEL ?? "claude-sonnet-5", apiKeyEnv: "ANTHROPIC_API_KEY" },
  { provider: "claude", tier: "deep", model: process.env.POMEBRAIN_CLAUDE_DEEP_MODEL ?? "claude-opus-4-8", apiKeyEnv: "ANTHROPIC_API_KEY" },
  { provider: "openai", tier: "fast", model: process.env.POMEBRAIN_OPENAI_FAST_MODEL ?? "gpt-4o-mini", apiKeyEnv: "OPENAI_API_KEY" },
  { provider: "openai", tier: "balanced", model: process.env.POMEBRAIN_OPENAI_BALANCED_MODEL ?? "gpt-4o", apiKeyEnv: "OPENAI_API_KEY" },
  { provider: "openai", tier: "deep", model: process.env.POMEBRAIN_OPENAI_DEEP_MODEL ?? "gpt-5", apiKeyEnv: "OPENAI_API_KEY" },
];

const COMPLEXITY_TO_TIER: Record<"low" | "medium" | "high", ModelTier> = {
  low: "fast",
  medium: "balanced",
  high: "deep",
};

function selectModel(request: Extract<CapabilityRequest, { capabilityId: "llm.cross_route" }>) {
  const tier = COMPLEXITY_TO_TIER[request.payload.complexity];
  const candidates = MODEL_CATALOG.filter(
    (option) => option.tier === tier && request.payload.preferredProviders.includes(option.provider as "claude" | "openai" | "gemini"),
  );
  const configured = candidates.filter((option) => Boolean(process.env[option.apiKeyEnv]));

  return { tier, chosen: configured[0] ?? candidates[0] ?? null };
}

export async function executeModelRouterCapability(request: CapabilityRequest) {
  if (request.capabilityId !== "llm.cross_route") {
    throw new Error(`Model router cannot handle capability "${request.capabilityId}".`);
  }

  const { tier, chosen } = selectModel(request);

  if (!chosen) {
    throw new Error(
      `No catalog model matches providers [${request.payload.preferredProviders.join(", ")}] at tier "${tier}". Add one to MODEL_CATALOG.`,
    );
  }

  const liveCallReady = Boolean(process.env[chosen.apiKeyEnv]);

  return {
    taskClass: request.payload.taskClass,
    complexity: request.payload.complexity,
    resolvedTier: tier,
    routedTo: { provider: chosen.provider, model: chosen.model },
    liveCallReady,
    message: liveCallReady
      ? `Routed to ${chosen.provider}:${chosen.model}. ${chosen.apiKeyEnv} is set, so live inference can run through this route.`
      : `Routed to ${chosen.provider}:${chosen.model}, but ${chosen.apiKeyEnv} is not set. Selection is ready; live calls are blocked until that key is configured.`,
  };
}
