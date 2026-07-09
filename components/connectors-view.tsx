"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Database, GitPullRequest, LockKeyhole, Mail, PlugZap, Rocket, ShieldAlert, Sparkles, Zap } from "lucide-react";
import { capabilityRegistry, type CapabilityDefinition } from "@/lib/mcp/capabilities";
import { ModelKeysPanel } from "@/components/model-keys-panel";

type HealthEnvironment = {
  supabase?: boolean;
  openai?: boolean;
  anthropic?: boolean;
  github?: boolean;
  vercel?: boolean;
  google?: boolean;
  fathom?: boolean;
};

type HealthPayload = {
  status?: string;
  environment?: HealthEnvironment;
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

function connectorReady(connectorId: CapabilityDefinition["connectorId"], env: HealthEnvironment) {
  const meta = connectorMeta[connectorId];
  if (meta.envKey === "model") return Boolean(env.openai || env.anthropic);
  return Boolean(env[meta.envKey]);
}

export function ConnectorsView() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedConnector, setSelectedConnector] = useState<CapabilityDefinition["connectorId"]>("model_router");

  useEffect(() => {
    let mounted = true;

    async function loadHealth() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        if (!response.ok) throw new Error(`Health check failed with HTTP ${response.status}.`);
        const payload = (await response.json()) as HealthPayload;
        if (mounted) setHealth(payload);
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "Unable to read connector health.");
      }
    }

    void loadHealth();

    return () => {
      mounted = false;
    };
  }, []);

  const capabilities = useMemo(() => Object.values(capabilityRegistry), []);
  const grouped = useMemo(() => {
    return capabilities.reduce<Record<CapabilityDefinition["connectorId"], CapabilityDefinition[]>>((next, capability) => {
      next[capability.connectorId] = [...(next[capability.connectorId] ?? []), capability];
      return next;
    }, {} as Record<CapabilityDefinition["connectorId"], CapabilityDefinition[]>);
  }, [capabilities]);

  const env = health?.environment ?? {};
  const connectorIds = Object.keys(grouped) as CapabilityDefinition["connectorId"][];
  const readyCount = connectorIds.filter((id) => connectorReady(id, env)).length;
  const selectedCapabilities = grouped[selectedConnector] ?? [];
  const approvalCount = capabilities.filter((capability) => capability.approvalPolicy !== "auto_run_allowed").length;

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
        <article><span>READY</span><strong>{String(readyCount).padStart(2, "0")}</strong><small>Server env detected</small></article>
        <article><span>CAPABILITIES</span><strong>{String(capabilities.length).padStart(2, "0")}</strong><small>Governed actions</small></article>
        <article><span>APPROVAL GATES</span><strong>{String(approvalCount).padStart(2, "0")}</strong><small>Human confirmation</small></article>
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
              const ready = connectorReady(connectorId, env);
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
                      {ready ? "Configured" : "Needs env"}
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
            <span className="seed-status status-approved">{connectorReady(selectedConnector, env) ? "ready" : "pending"}</span>
          </div>
          <h2>{connectorMeta[selectedConnector].title}</h2>
          <p>{connectorMeta[selectedConnector].subtitle}</p>

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

      <section className="graph-card panel-card">
        <div className="panel-heading">
          <div><span className="section-label">PER-WORKSPACE APPS</span><h2>Connect your own accounts</h2></div>
          <div className="graph-legend"><ShieldAlert size={14} /> Not live yet</div>
        </div>
        <p className="model-keys-subtitle">
          The goal: connect your own Google Drive, Gmail, Fathom, Supabase, and Vercel accounts so builds Pomebrain
          makes for you host and store data under your own accounts, not a shared admin one. Each of these needs an
          OAuth app registered with that provider first - that&apos;s a one-time setup step, not code, and it hasn&apos;t
          been done yet for any of them.
        </p>
        <div className="external-connector-grid">
          {[
            { name: "Vercel", blocker: "Needs a Vercel Integration registered at vercel.com/dashboard/integrations/console." },
            { name: "Supabase", blocker: "Needs a Supabase OAuth App from Supabase's partner program." },
            { name: "Google Drive / Gmail", blocker: "Needs an OAuth Client from Google Cloud Console (separate from the sign-in one)." },
            { name: "Fathom", blocker: "Needs an API/OAuth credential issued by Fathom." },
          ].map((item) => (
            <article key={item.name} className="external-connector-card">
              <strong>{item.name}</strong>
              <span className="connector-waiting"><ShieldAlert size={12} /> Awaiting setup</span>
              <p>{item.blocker}</p>
            </article>
          ))}
        </div>
      </section>

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
