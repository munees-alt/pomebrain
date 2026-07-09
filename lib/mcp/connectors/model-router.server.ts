import "server-only";

import type { CapabilityRequest } from "@/lib/mcp/capabilities";
import { getWorkspaceModelKey } from "@/lib/secrets/workspace-model-keys.server";

type LlmCrossRouteRequest = Extract<CapabilityRequest, { capabilityId: "llm.cross_route" }>;
type ModelTier = "fast" | "balanced" | "deep";
type Provider = "claude" | "openai" | "gemini";
type ProviderFetch = typeof fetch;

type ModelOption = {
  provider: Provider;
  model: string;
  tier: ModelTier;
  apiKeyEnv: "ANTHROPIC_API_KEY" | "OPENAI_API_KEY" | "GOOGLE_API_KEY";
};

type ModelRouterFailureCode =
  | "no_model_match"
  | "provider_not_implemented"
  | "missing_api_key"
  | "provider_http_error"
  | "provider_response_error";

type KeySource = "workspace" | "server";

type ModelRouterResult =
  | {
      status: "completed";
      taskClass: LlmCrossRouteRequest["payload"]["taskClass"];
      complexity: LlmCrossRouteRequest["payload"]["complexity"];
      resolvedTier: ModelTier;
      routedTo: { provider: Provider; model: string };
      keySource: KeySource;
      liveCallReady: true;
      text: string;
      usage?: unknown;
    }
  | {
      status: "model_call_failed";
      taskClass: LlmCrossRouteRequest["payload"]["taskClass"];
      complexity: LlmCrossRouteRequest["payload"]["complexity"];
      resolvedTier: ModelTier;
      routedTo: { provider: Provider; model: string } | null;
      liveCallReady: false;
      error: {
        code: ModelRouterFailureCode;
        message: string;
        provider?: Provider;
        model?: string;
        httpStatus?: number;
      };
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

let providerFetch: ProviderFetch = fetch;

export function setModelProviderFetchForTest(nextFetch: ProviderFetch) {
  providerFetch = nextFetch;
}

export function resetModelProviderFetchForTest() {
  providerFetch = fetch;
}

function selectModel(request: LlmCrossRouteRequest) {
  const tier = COMPLEXITY_TO_TIER[request.payload.complexity];
  const candidates = MODEL_CATALOG.filter((option) => option.tier === tier && request.payload.preferredProviders.includes(option.provider));

  candidates.sort(
    (a, b) => request.payload.preferredProviders.indexOf(a.provider) - request.payload.preferredProviders.indexOf(b.provider),
  );

  return { tier, chosen: candidates[0] ?? null };
}

function failureResult(
  request: LlmCrossRouteRequest,
  tier: ModelTier,
  chosen: ModelOption | null,
  code: ModelRouterFailureCode,
  message: string,
  httpStatus?: number,
): ModelRouterResult {
  return {
    status: "model_call_failed",
    taskClass: request.payload.taskClass,
    complexity: request.payload.complexity,
    resolvedTier: tier,
    routedTo: chosen ? { provider: chosen.provider, model: chosen.model } : null,
    liveCallReady: false,
    error: {
      code,
      message,
      provider: chosen?.provider,
      model: chosen?.model,
      httpStatus,
    },
  };
}

function extractOpenAiText(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object") return null;
  const body = responseBody as { output_text?: unknown; output?: unknown };

  if (typeof body.output_text === "string" && body.output_text.trim()) {
    return body.output_text;
  }

  if (!Array.isArray(body.output)) return null;

  const chunks: string[] = [];
  for (const item of body.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;

    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") chunks.push(text);
    }
  }

  return chunks.join("").trim() || null;
}

function extractAnthropicText(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object") return null;
  const content = (responseBody as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;

  const chunks = content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const typed = part as { type?: unknown; text?: unknown };
      return typed.type === "text" && typeof typed.text === "string" ? typed.text : "";
    })
    .filter(Boolean);

  return chunks.join("").trim() || null;
}

async function readProviderError(response: Response) {
  try {
    const body = (await response.json()) as { error?: { message?: string }; message?: string };
    return body.error?.message ?? body.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

async function callOpenAi(request: LlmCrossRouteRequest, chosen: ModelOption, apiKey: string) {
  const response = await providerFetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: chosen.model,
      input: request.payload.systemPrompt
        ? [
            { role: "system", content: request.payload.systemPrompt },
            { role: "user", content: request.payload.input },
          ]
        : request.payload.input,
      max_output_tokens: request.payload.maxOutputTokens,
    }),
  });

  if (!response.ok) {
    return { ok: false as const, httpStatus: response.status, message: await readProviderError(response) };
  }

  const body = await response.json();
  const text = extractOpenAiText(body);

  if (!text) {
    return { ok: false as const, message: "OpenAI response did not include output text." };
  }

  return { ok: true as const, text, usage: (body as { usage?: unknown }).usage };
}

async function callAnthropic(request: LlmCrossRouteRequest, chosen: ModelOption, apiKey: string) {
  const response = await providerFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: chosen.model,
      max_tokens: request.payload.maxOutputTokens,
      system: request.payload.systemPrompt,
      messages: [{ role: "user", content: request.payload.input }],
    }),
  });

  if (!response.ok) {
    return { ok: false as const, httpStatus: response.status, message: await readProviderError(response) };
  }

  const body = await response.json();
  const text = extractAnthropicText(body);

  if (!text) {
    return { ok: false as const, message: "Anthropic response did not include text content." };
  }

  return { ok: true as const, text, usage: (body as { usage?: unknown }).usage };
}

export async function executeModelRouterCapability(request: CapabilityRequest): Promise<ModelRouterResult> {
  if (request.capabilityId !== "llm.cross_route") {
    throw new Error(`Model router cannot handle capability "${request.capabilityId}".`);
  }

  const { tier, chosen } = selectModel(request);

  if (!chosen) {
    return failureResult(
      request,
      tier,
      null,
      "no_model_match",
      `No catalog model matches providers [${request.payload.preferredProviders.join(", ")}] at tier "${tier}".`,
    );
  }

  if (chosen.provider === "gemini") {
    return failureResult(request, tier, chosen, "provider_not_implemented", "Gemini routing is cataloged but not implemented yet.");
  }

  const workspaceId = request.metadata.workspaceId;
  const workspaceKey = workspaceId ? await getWorkspaceModelKey(workspaceId, chosen.provider) : null;
  const apiKey = workspaceKey ?? process.env[chosen.apiKeyEnv];
  const keySource: KeySource = workspaceKey ? "workspace" : "server";

  if (!apiKey) {
    return failureResult(
      request,
      tier,
      chosen,
      "missing_api_key",
      `No workspace key configured and ${chosen.apiKeyEnv} is not set on the server. Pomebrain will not fall back to another provider silently.`,
    );
  }

  try {
    const providerResult =
      chosen.provider === "openai" ? await callOpenAi(request, chosen, apiKey) : await callAnthropic(request, chosen, apiKey);

    if (!providerResult.ok) {
      return failureResult(
        request,
        tier,
        chosen,
        providerResult.httpStatus ? "provider_http_error" : "provider_response_error",
        providerResult.message,
        providerResult.httpStatus,
      );
    }

    return {
      status: "completed",
      taskClass: request.payload.taskClass,
      complexity: request.payload.complexity,
      resolvedTier: tier,
      routedTo: { provider: chosen.provider, model: chosen.model },
      keySource,
      liveCallReady: true,
      text: providerResult.text,
      usage: providerResult.usage,
    };
  } catch (error) {
    return failureResult(
      request,
      tier,
      chosen,
      "provider_response_error",
      error instanceof Error ? error.message : "Unknown provider call failure.",
    );
  }
}
