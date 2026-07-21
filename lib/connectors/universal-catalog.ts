import type { CapabilityDefinition, CapabilityId } from "@/lib/mcp/capabilities";

const liveCustomerCapabilityIds = new Set<CapabilityId>([
  "supabase.database.read",
  "supabase.task_state.write",
  "github.pull_requests.create",
  "github.branches.merge",
  "vercel.deploy.preview",
  "vercel.deploy.production",
  "google.drive.read",
  "google.drive.write",
  "google.gmail.send",
  "llm.cross_route",
]);

export function isLiveCustomerCapability(capabilityId: CapabilityId) {
  return liveCustomerCapabilityIds.has(capabilityId);
}

export const connectorRequirementKinds = [
  "app_hosting",
  "backend_database",
  "auth",
  "file_storage",
  "spreadsheet_data",
  "source_control",
  "email_delivery",
  "analytics",
  "knowledge_source",
  "model_reasoning",
] as const;

export type ConnectorRequirementKind = (typeof connectorRequirementKinds)[number];
export type UniversalConnectorId = CapabilityDefinition["connectorId"];

export type UniversalConnectorDefinition = {
  id: UniversalConnectorId;
  title: string;
  role: string;
  providedRequirements: ConnectorRequirementKind[];
  capabilityIds: CapabilityId[];
  customerOwned: boolean;
};

export type ConnectorRequirementMatch = {
  requirement: ConnectorRequirementKind;
  label: string;
  reason: string;
  candidates: {
    connectorId: UniversalConnectorId;
    title: string;
    capabilityIds: CapabilityId[];
    ready: boolean;
    customerOwned: boolean;
  }[];
};

export type UniversalConnectorEnvironment = Partial<Record<"supabase" | "github" | "vercel" | "google" | "fathom" | "openai" | "anthropic", boolean>>;

export const universalConnectorCatalog: Record<UniversalConnectorId, UniversalConnectorDefinition> = {
  supabase_connector: {
    id: "supabase_connector",
    title: "Supabase",
    role: "Structured backend, auth, storage, and schema inspection when the app needs durable product data.",
    providedRequirements: ["backend_database", "auth", "file_storage"],
    capabilityIds: ["supabase.database.read", "supabase.task_state.write"],
    customerOwned: true,
  },
  github_connector: {
    id: "github_connector",
    title: "GitHub",
    role: "Source control, branches, pull requests, reviews, and code handoff.",
    providedRequirements: ["source_control"],
    capabilityIds: ["github.pull_requests.create", "github.branches.merge"],
    customerOwned: true,
  },
  vercel_connector: {
    id: "vercel_connector",
    title: "Vercel",
    role: "Preview and production hosting for web applications.",
    providedRequirements: ["app_hosting"],
    capabilityIds: ["vercel.deploy.preview", "vercel.deploy.production"],
    customerOwned: true,
  },
  google_workspace_connector: {
    id: "google_workspace_connector",
    title: "Google Workspace",
    role: "Drive, Sheets-compatible storage, Gmail, and user-owned workspace documents.",
    providedRequirements: ["file_storage", "spreadsheet_data", "email_delivery", "knowledge_source"],
    capabilityIds: ["google.drive.read", "google.drive.write", "google.gmail.send"],
    customerOwned: true,
  },
  fathom_connector: {
    id: "fathom_connector",
    title: "Fathom",
    role: "Site analytics and conversion signals after an app is live.",
    providedRequirements: ["analytics"],
    capabilityIds: ["fathom.analytics.read"],
    customerOwned: true,
  },
  model_router: {
    id: "model_router",
    title: "Model Router",
    role: "Reasoning, coding, review, and synthesis through the best available model provider.",
    providedRequirements: ["model_reasoning"],
    capabilityIds: ["llm.cross_route"],
    customerOwned: true,
  },
  anthropic_connector: {
    id: "anthropic_connector",
    title: "Anthropic",
    role: "Claude provider key for model routing.",
    providedRequirements: ["model_reasoning"],
    capabilityIds: ["llm.cross_route"],
    customerOwned: true,
  },
  openai_connector: {
    id: "openai_connector",
    title: "OpenAI",
    role: "OpenAI provider key for model routing.",
    providedRequirements: ["model_reasoning"],
    capabilityIds: ["llm.cross_route"],
    customerOwned: true,
  },
};

const requirementLabels: Record<ConnectorRequirementKind, string> = {
  app_hosting: "App hosting",
  backend_database: "Backend database",
  auth: "Authentication",
  file_storage: "File storage",
  spreadsheet_data: "Spreadsheet data",
  source_control: "Source control",
  email_delivery: "Email delivery",
  analytics: "Analytics",
  knowledge_source: "Knowledge source",
  model_reasoning: "Model reasoning",
};

const requirementReasons: Record<ConnectorRequirementKind, string> = {
  app_hosting: "The requested outcome should have a live URL or deployable web surface.",
  backend_database: "The app needs durable structured data, tenant state, or server-side records.",
  auth: "The app mentions users, clients, teams, accounts, permissions, or private workflows.",
  file_storage: "The app needs uploads, documents, generated files, or attached evidence.",
  spreadsheet_data: "The app can use tables, trackers, imports, exports, or lightweight operational data.",
  source_control: "The build should preserve code, branches, review history, or handoff artifacts.",
  email_delivery: "The workflow sends messages, reminders, invites, or customer communication.",
  analytics: "The user needs metrics, funnel tracking, conversion visibility, or performance signals.",
  knowledge_source: "The build depends on existing docs, Drive files, sheets, policies, or reference material.",
  model_reasoning: "Agents need a model provider to reason, code, review, and summarize.",
};

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

export function inferConnectorRequirements(goal: string): ConnectorRequirementKind[] {
  const normalized = goal.toLowerCase();
  const requirements: ConnectorRequirementKind[] = ["model_reasoning"];

  if (/app|site|portal|dashboard|web|page|frontend|mobile|deploy|host|live|url|launch/.test(normalized)) {
    requirements.push("app_hosting");
  }

  if (/database|backend|record|client|customer|invoice|order|task|workflow|status|crm|inventory|booking|form|submission|table/.test(normalized)) {
    requirements.push("backend_database");
  }

  if (/login|signup|sign in|auth|user|client|team|member|role|permission|private|account|workspace/.test(normalized)) {
    requirements.push("auth");
  }

  if (/upload|file|document|pdf|image|attachment|folder|drive|storage|evidence/.test(normalized)) {
    requirements.push("file_storage");
  }

  if (/sheet|spreadsheet|csv|excel|tracker|tabular|import|export|rows|columns/.test(normalized)) {
    requirements.push("spreadsheet_data");
  }

  if (/email|gmail|invite|reminder|notify|message|follow up|send/.test(normalized)) {
    requirements.push("email_delivery");
  }

  if (/analytics|metric|conversion|funnel|traffic|retention|cohort|fathom|report/.test(normalized)) {
    requirements.push("analytics");
  }

  if (/github|repo|repository|branch|pull request|code review|source/.test(normalized)) {
    requirements.push("source_control");
  }

  if (/knowledge|docs|documentation|policy|manual|reference|drive|notion|existing files|source material/.test(normalized)) {
    requirements.push("knowledge_source");
  }

  return unique(requirements);
}

export function connectorIsReady(connectorId: UniversalConnectorId, env: UniversalConnectorEnvironment) {
  switch (connectorId) {
    case "model_router":
      return Boolean(env.openai || env.anthropic);
    case "anthropic_connector":
      return Boolean(env.anthropic);
    case "openai_connector":
      return Boolean(env.openai);
    case "google_workspace_connector":
      return Boolean(env.google);
    case "supabase_connector":
      return Boolean(env.supabase);
    case "github_connector":
      return Boolean(env.github);
    case "vercel_connector":
      return Boolean(env.vercel);
    case "fathom_connector":
      return Boolean(env.fathom);
  }
}

export function planUniversalConnectors(goal: string, env: UniversalConnectorEnvironment = {}): ConnectorRequirementMatch[] {
  return inferConnectorRequirements(goal).map((requirement) => {
    const candidates = Object.values(universalConnectorCatalog)
      .filter((connector) => connector.providedRequirements.includes(requirement) && connector.capabilityIds.some((id) => liveCustomerCapabilityIds.has(id)))
      .map((connector) => ({
        connectorId: connector.id,
        title: connector.title,
        capabilityIds: connector.capabilityIds,
        ready: connectorIsReady(connector.id, env),
        customerOwned: connector.customerOwned,
      }));

    return {
      requirement,
      label: requirementLabels[requirement],
      reason: requirementReasons[requirement],
      candidates,
    };
  });
}
