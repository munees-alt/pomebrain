"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Database, GitPullRequest, Loader2, LockKeyhole, Mail, PlugZap, Rocket, ShieldAlert, Sparkles, Zap } from "lucide-react";
import { capabilityRegistry, type CapabilityDefinition } from "@/lib/mcp/capabilities";
import { ModelKeysPanel } from "@/components/model-keys-panel";
import { WorkspaceConnectorKeysPanel } from "@/components/workspace-connector-keys-panel";
import { GoogleWorkspacePanel } from "@/components/google-workspace-panel";
import { connectorRequirementKinds, isLiveCustomerCapability, universalConnectorCatalog } from "@/lib/connectors/universal-catalog";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type HealthEnvironment = {
  supabase?: boolean;
  openai?: boolean;
  anthropic?: boolean;
  github?: boolean;
  vercel?: boolean;
  google?: boolean;
  fathom?: boolean;
};

const connectorMeta: Record<
  CapabilityDefinition["connectorId"],
  {
    title: string;
    subtitle: string;
    envKey: keyof HealthEnvironment | "model";
    icon: typeof PlugZap;
  }
> = {
  supabase_connector: {
    title: "Supabase",
    subtitle: "Tenant data, RLS reads, migrations, and task state.",
    envKey: "supabase",
    icon: Database,
  },
  github_connector: {
    title: "GitHub",
    subtitle: "Branches, pull requests, and code review handoff.",
    envKey: "github",
    icon: GitPullRequest,
  },
  vercel_connector: {
    title: "Vercel",
    subtitle: "Preview deployment and production promotion gates.",
    envKey: "vercel",
    icon: Rocket,
  },
  anthropic_connector: {
    title: "Anthropic",
    subtitle: "Claude model calls through governed model routing.",
    envKey: "anthropic",
    icon: Sparkles,
  },
  openai_connector: {
    title: "OpenAI",
    subtitle: "OpenAI model calls through governed model routing.",
    envKey: "openai",
    icon: Zap,
  },
  google_workspace_connector: {
    title: "Google Workspace",
    subtitle: "Drive reads/writes and Gmail communication workflows.",
    envKey: "google",
    icon: Mail,
  },
  fathom_connector: {
    title: "Fathom",
    subtitle: "Analytics reads for product conversion metadata.",
    envKey: "fathom",
    icon: PlugZap,
  },
  model_router: {
    title: "Model Router",
    subtitle: "Cross-routes work to OpenAI, Claude, and future providers.",
    envKey: "model",
    icon: Sparkles,
  },
};

function readable(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function connectorReady(connectorId: CapabilityDefinition["connectorId"], connected: Set<string>) {
  const providers: Record<CapabilityDefinition["connectorId"], string[]> = {
    supabase_connector: ["supabase"],
    github_connector: ["github"],
    vercel_connector: ["vercel"],
    anthropic_connector: ["claude"],
    openai_connector: ["openai"],
    google_workspace_connector: ["google_workspace"],
    fathom_connector: ["fathom"],
    model_router: ["claude", "openai"],
  };
  return providers[connectorId].some((provider) => connected.has(provider));
}

export function ConnectorsView() {
  const [error, setError] = useState<string | null>(null);
  const [healthEnvironment, setHealthEnvironment] = useState<HealthEnvironment>({});
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());
  const [selectedConnector, setSelectedConnector] = useState<CapabilityDefinition["connectorId"]>("model_router");
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<Array<{ provider: string; ready: boolean; message: string }> | null>(null);

  async function verifyProductionPath() {
    setVerifying(true);
    setError(null);
    try {
      const response = await fetch("/api/connectors/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as { results?: Array<{ provider: string; ready: boolean; message: string }>; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to verify the production path.");
      setVerification(payload.results ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to verify the production path.");
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadHealth() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        if (!response.ok) throw new Error(`Health check failed with HTTP ${response.status}.`);
        const payload = (await response.json()) as { environment?: HealthEnvironment };
        if (mounted) setHealthEnvironment(payload.environment ?? {});
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "Unable to read connector health.");
      }
    }

    void loadHealth();

    async function loadCustomerConnections() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const workspaceId = data.session?.user.app_metadata?.workspace_id as string | undefined;
        if (!workspaceId) return;
        const [models, secrets, oauth] = await Promise.all([
          supabase.rpc("list_workspace_model_keys", { p_workspace_id: workspaceId }),
          supabase.rpc("list_workspace_connector_secrets", { p_workspace_id: workspaceId }),
          supabase.rpc("list_workspace_oauth_connections", { p_workspace_id: workspaceId }),
        ]);
        if (!mounted) return;
        setConnectedProviders(new Set([
          ...((models.data ?? []) as Array<{ provider: string }>).map((row) => row.provider),
          ...((secrets.data ?? []) as Array<{ provider: string }>).map((row) => row.provider),
          ...((oauth.data ?? []) as Array<{ provider: string }>).map((row) => row.provider),
        ]));
      } catch {
        // Individual connector panels provide detailed setup errors.
      }
    }

    void loadCustomerConnections();

    return () => {
      mounted = false;
    };
  }, []);

  const capabilities = useMemo(() => Object.values(capabilityRegistry).filter((capability) => isLiveCustomerCapability(capability.id)), []);
  const grouped = useMemo(() => {
    return capabilities.reduce<Record<CapabilityDefinition["connectorId"], CapabilityDefinition[]>>((next, capability) => {
      next[capability.connectorId] = [...(next[capability.connectorId] ?? []), capability];
      return next;
    }, {} as Record<CapabilityDefinition["connectorId"], CapabilityDefinition[]>);
  }, [capabilities]);

  const connectorIds = Object.keys(grouped) as CapabilityDefinition["connectorId"][];
  const readyCount = connectorIds.filter((id) => connectorReady(id, connectedProviders)).length;
  const selectedCapabilities = grouped[selectedConnector] ?? [];
  const approvalCount = capabilities.filter((capability) => capability.approvalPolicy !== "auto_run_allowed").length;
  const universalConnectors = Object.values(universalConnectorCatalog).filter((connector) => connector.capabilityIds.some(isLiveCustomerCapability));

  return (
    <div className="view-scroll brain-page">
      <section className="page-intro brain-intro">
        <div>
          <span className="eyebrow"><span /> CONNECTOR CONTROL</span>
          <h1>Every outside door,<br /><em>behind one policy gate.</em></h1>
          <p>Connectors expose capabilities to agents without exposing raw credentials to the browser. Agents request capability IDs; Pomebrain applies approval policy.</p>
        </div>
      </section>

      <section className="metric-strip" aria-label="Connector metrics">
        <article><span>CONNECTORS</span><strong>{String(connectorIds.length).padStart(2, "0")}</strong><small>Registered families</small></article>
        <article><span>CONNECTED</span><strong>{String(readyCount).padStart(2, "0")}</strong><small>Your workspace accounts</small></article>
        <article><span>CAPABILITIES</span><strong>{String(capabilities.length).padStart(2, "0")}</strong><small>Governed actions</small></article>
        <article><span>BUILD NEEDS</span><strong>{String(connectorRequirementKinds.length).padStart(2, "0")}</strong><small>Universal planner</small></article>
      </section>

      {error ? (
        <section className="graph-card panel-card">
          <div className="panel-heading">
            <div><span className="section-label">CONNECTOR HEALTH</span><h2>Unable to load health</h2></div>
          </div>
          <p>{error}</p>
        </section>
      ) : null}

      <ModelKeysPanel />
      <WorkspaceConnectorKeysPanel />
      <GoogleWorkspacePanel envReady={Boolean(healthEnvironment.google)} />

      <section className="graph-card panel-card">
        <div className="panel-heading">
          <div><span className="section-label">PRODUCTION PREFLIGHT</span><h2>Verify the real build path</h2></div>
          <button className="outline-action" type="button" disabled={verifying} onClick={() => void verifyProductionPath()}>
            {verifying ? <Loader2 className="spin" size={14} /> : <ShieldAlert size={14} />} {verifying ? "Verifying" : "Run verification"}
          </button>
        </div>
        <p className="model-keys-subtitle">This performs read-only checks against your model provider, GitHub repository, Vercel project, and Supabase project. Stored credentials alone are not treated as ready.</p>
        {verification ? (
          <div className="universal-connector-tags">
            {verification.map((item) => (
              <span key={item.provider} className={item.ready ? "connector-ready" : "connector-waiting"} title={item.message}>
                {item.ready ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />} {readable(item.provider)}: {item.ready ? "Verified" : item.message}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="graph-card panel-card">
        <div className="panel-heading">
          <div><span className="section-label">UNIVERSAL CONNECTOR LAYER</span><h2>Any tool can become a build hand</h2></div>
          <div className="graph-legend"><PlugZap size={14} /> {approvalCount} gated actions</div>
        </div>
        <p className="model-keys-subtitle">
          Agents do not choose a fixed stack. App Factory maps each build requirement to whatever connected tool can
          satisfy it: hosting, database, auth, files, sheets, email, analytics, source control, knowledge, and models.
        </p>
        <div className="universal-connector-grid">
          {universalConnectors.map((connector) => (
            <article key={connector.id} className="external-connector-card">
              <strong>{connector.title}</strong>
              <span className={connectorReady(connector.id, connectedProviders) ? "connector-ready" : "connector-waiting"}>
                {connectorReady(connector.id, connectedProviders) ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
                {connectorReady(connector.id, connectedProviders) ? "Connected" : "Connect when needed"}
              </span>
              <p>{connector.role}</p>
              {connector.id === "google_workspace_connector" ? (
                <a className="inline-connect-action" href="/api/connectors/google/start" aria-disabled={!healthEnvironment.google}>
                  {connectorReady(connector.id, connectedProviders) ? "Reconnect Google" : "Connect with Google"}
                </a>
              ) : null}
              <div className="universal-connector-tags">
                {connector.providedRequirements.map((requirement) => (
                  <span key={`${connector.id}-${requirement}`}>{readable(requirement)}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="connectors-layout">
        <section className="panel-card connector-map">
          <div className="panel-heading">
            <div><span className="section-label">CAPABILITY ROUTER</span><h2>Connector registry</h2></div>
            <div className="graph-legend"><span className="live-pulse" /> Server-side boundary</div>
          </div>

          <div className="connector-card-grid">
            {connectorIds.map((connectorId) => {
              const meta = connectorMeta[connectorId];
              const Icon = meta.icon;
              const ready = connectorReady(connectorId, connectedProviders);
              const active = connectorId === selectedConnector;

              return (
                <button
                  key={connectorId}
                  type="button"
                  className={`connector-card${active ? " active" : ""}`}
                  onClick={() => setSelectedConnector(connectorId)}
                >
                  <span className="connector-icon"><Icon size={18} /></span>
                  <span className="connector-body">
                    <strong>{meta.title}</strong>
                    <small>{meta.subtitle}</small>
                    <span className={ready ? "connector-ready" : "connector-waiting"}>
                      {ready ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
                      {ready ? "Connected" : "Connect your account"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="panel-card connector-detail">
          <div className="inspector-topline">
            <span className="kind-badge kind-tool">{connectorMeta[selectedConnector].title}</span>
            <span className="seed-status status-approved">{connectorReady(selectedConnector, connectedProviders) ? "connected" : "pending"}</span>
          </div>
          <h2>{connectorMeta[selectedConnector].title}</h2>
          <p>{connectorMeta[selectedConnector].subtitle}</p>
          {selectedConnector === "google_workspace_connector" ? (
            <a className="outline-action google-connect-link" href="/api/connectors/google/start" aria-disabled={!healthEnvironment.google}>
              {connectorReady(selectedConnector, connectedProviders) ? "Reconnect Google" : "Connect with Google"}
            </a>
          ) : null}

          <div className="capability-list">
            {selectedCapabilities.map((capability) => (
              <article key={capability.id} className="capability-row">
                <div>
                  <span>{capability.id}</span>
                  <strong>{capability.targetActions.join(", ")}</strong>
                </div>
                <small className={`policy-pill ${capability.approvalPolicy}`}>
                  <LockKeyhole size={11} />
                  {readable(capability.approvalPolicy)}
                </small>
                <small>{readable(capability.safetyClass)}</small>
              </article>
            ))}
          </div>
        </aside>
      </div>

      <section className="foundation-row">
        <article className="foundation-card">
          <span className="icon-box"><LockKeyhole size={20} /></span>
          <div><span>SECRET BOUNDARY</span><strong>No browser credentials</strong><p>Only readiness booleans and capability policy reach the UI.</p></div>
        </article>
        <article className="foundation-card">
          <span className="icon-box"><ShieldAlert size={20} /></span>
          <div><span>APPROVALS</span><strong>Risk controls route action</strong><p>Production deploys, merges, migrations, and emails stay gated.</p></div>
        </article>
        <article className="foundation-card">
          <span className="icon-box"><PlugZap size={20} /></span>
          <div><span>MCP</span><strong>Agents request capabilities</strong><p>Connectors execute behind Pomebrain&apos;s server policy boundary.</p></div>
        </article>
        <article className="foundation-card special">
          <span className="icon-box"><Sparkles size={20} /></span>
          <div><span>LIVE ROUTING</span><strong>Model router is wired</strong><p>Provider failures return structured errors instead of fake success.</p></div>
        </article>
      </section>
    </div>
  );
}
