"use client";

import { useEffect, useState } from "react";
import { Check, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { createSupabaseBrowserClient, hasSupabaseBrowserEnv } from "@/lib/supabase-client";

type Provider = "github" | "vercel" | "supabase";
type ConnectorRow = { provider: Provider; account_label: string | null; metadata: Record<string, unknown>; updated_at: string };
type Draft = { secret: string; label: string; projectUrl: string; teamId: string; gitOrg: string; gitRepo: string; baseBranch: string; projectId: string };

const emptyDraft: Draft = { secret: "", label: "", projectUrl: "", teamId: "", gitOrg: "", gitRepo: "", baseBranch: "main", projectId: "" };

const CONNECTORS: Array<{
  id: Provider;
  name: string;
  kind: string;
  placeholder: string;
  capabilities: string[];
  help: string;
}> = [
  {
    id: "github",
    name: "GitHub",
    kind: "personal_access_token",
    placeholder: "github_pat_...",
    capabilities: ["github.repository.write", "github.pull_requests.create", "github.branches.merge"],
    help: "Used only to write a governed build branch and open pull requests in the repository you authorize.",
  },
  {
    id: "vercel",
    name: "Vercel",
    kind: "access_token",
    placeholder: "Vercel access token",
    capabilities: ["vercel.deploy.preview", "vercel.deploy.production"],
    help: "Used to create previews and approved production promotions in your Vercel account.",
  },
  {
    id: "supabase",
    name: "Supabase",
    kind: "service_role_key",
    placeholder: "Your project service-role key",
    capabilities: ["supabase.database.read", "supabase.migrations.apply"],
    help: "Used server-side for the Supabase project URL you provide. Never exposed to the browser after saving.",
  },
];

export function WorkspaceConnectorKeysPanel() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [rows, setRows] = useState<ConnectorRow[]>([]);
  const [drafts, setDrafts] = useState<Record<Provider, Draft>>({
    github: { ...emptyDraft }, vercel: { ...emptyDraft }, supabase: { ...emptyDraft },
  });
  const [busy, setBusy] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function refresh(supabase = createSupabaseBrowserClient(), id = workspaceId) {
    if (!id) return;
    const { data, error } = await supabase.rpc("list_workspace_connector_secrets", { p_workspace_id: id });
    if (error) throw error;
    setRows((data ?? []) as ConnectorRow[]);
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        if (!hasSupabaseBrowserEnv()) throw new Error("Workspace connections are unavailable.");
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const id = data.session?.user.app_metadata?.workspace_id as string | undefined;
        if (!id) throw new Error("Sign in again to manage workspace connections.");
        if (!mounted) return;
        setWorkspaceId(id);
        const result = await supabase.rpc("list_workspace_connector_secrets", { p_workspace_id: id });
        if (result.error) throw result.error;
        if (mounted) setRows((result.data ?? []) as ConnectorRow[]);
      } catch (cause) {
        if (mounted) setMessage({ tone: "error", text: cause instanceof Error ? cause.message : "Unable to load connections." });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  function updateDraft(provider: Provider, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [provider]: { ...current[provider], ...patch } }));
  }

  async function save(provider: Provider) {
    const definition = CONNECTORS.find((item) => item.id === provider)!;
    const draft = drafts[provider];
    if (!workspaceId || !draft.secret.trim()) return;
    setBusy(provider);
    setMessage(null);
    try {
      const metadata: Record<string, string> = {};
      if (draft.projectUrl.trim()) metadata.project_url = draft.projectUrl.trim();
      if (draft.teamId.trim()) metadata.team_id = draft.teamId.trim();
      if (draft.projectId.trim()) metadata.project_id = draft.projectId.trim();
      if (draft.gitOrg.trim()) metadata.git_org = draft.gitOrg.trim();
      if (draft.gitRepo.trim()) metadata.git_repo = draft.gitRepo.trim();
      if (provider === "github" && draft.gitOrg.trim()) metadata.owner = draft.gitOrg.trim();
      if (provider === "github" && draft.gitRepo.trim()) metadata.repo = draft.gitRepo.trim();
      if (provider === "github") metadata.base_branch = draft.baseBranch.trim() || "main";
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("set_workspace_connector_secret", {
        p_workspace_id: workspaceId,
        p_provider: provider,
        p_credential_kind: definition.kind,
        p_secret_value: draft.secret.trim(),
        p_account_label: draft.label.trim() || null,
        p_capability_ids: definition.capabilities,
        p_metadata: metadata,
      });
      if (error) throw error;
      await refresh(supabase, workspaceId);
      setDrafts((current) => ({ ...current, [provider]: { ...emptyDraft } }));
      setMessage({ tone: "success", text: `${definition.name} is connected to this workspace.` });
    } catch (cause) {
      setMessage({ tone: "error", text: cause instanceof Error ? cause.message : "Unable to save this connection." });
    } finally {
      setBusy(null);
    }
  }

  async function remove(provider: Provider) {
    const definition = CONNECTORS.find((item) => item.id === provider)!;
    if (!workspaceId) return;
    setBusy(provider);
    setMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("delete_workspace_connector_secret", {
        p_workspace_id: workspaceId,
        p_provider: provider,
        p_credential_kind: definition.kind,
      });
      if (error) throw error;
      setRows((current) => current.filter((row) => row.provider !== provider));
      setMessage({ tone: "success", text: `${definition.name} was disconnected.` });
    } catch (cause) {
      setMessage({ tone: "error", text: cause instanceof Error ? cause.message : "Unable to remove this connection." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel-card model-keys-card">
      <div className="panel-heading">
        <div><span className="section-label">YOUR BUILD ACCOUNTS</span><h2>Connect your own tools</h2></div>
        <div className="graph-legend"><ShieldCheck size={14} /> Encrypted per workspace</div>
      </div>
      <p className="model-keys-subtitle">Pomebrain never uses the master admin&apos;s GitHub, Vercel, Supabase, or analytics credentials for customer work. Every agent action runs against the account you connect here.</p>
      {loading ? <p className="model-keys-status">Loading your connections…</p> : null}
      {message ? <p className={`login-message ${message.tone}`}>{message.text}</p> : null}

      {!loading && workspaceId ? (
        <div className="workspace-connector-grid">
          {CONNECTORS.map((definition) => {
            const connected = rows.find((row) => row.provider === definition.id);
            const draft = drafts[definition.id];
            return (
              <article key={definition.id} className="workspace-connector-form">
                <div className="model-key-row-heading">
                  <span className="model-key-icon"><KeyRound size={14} /></span>
                  <strong>{definition.name}</strong>
                  <span className={connected ? "model-key-configured" : "model-key-unconfigured"}>
                    {connected ? <><Check size={12} /> Connected</> : "Not connected"}
                  </span>
                </div>
                <p>{definition.help}</p>
                <input value={draft.label} onChange={(event) => updateDraft(definition.id, { label: event.target.value })} placeholder="Account label (optional)" />
                {definition.id === "github" ? (
                  <div className="connector-metadata-grid">
                    <input value={draft.gitOrg} onChange={(event) => updateDraft(definition.id, { gitOrg: event.target.value })} placeholder="Repository owner or organization" />
                    <input value={draft.gitRepo} onChange={(event) => updateDraft(definition.id, { gitRepo: event.target.value })} placeholder="Repository name" />
                    <input value={draft.baseBranch} onChange={(event) => updateDraft(definition.id, { baseBranch: event.target.value })} placeholder="Base branch (main)" />
                  </div>
                ) : null}
                {definition.id === "supabase" ? <input value={draft.projectUrl} onChange={(event) => updateDraft(definition.id, { projectUrl: event.target.value })} placeholder="https://your-project.supabase.co" /> : null}
                {definition.id === "vercel" ? (
                  <div className="connector-metadata-grid">
                    <input value={draft.projectId} onChange={(event) => updateDraft(definition.id, { projectId: event.target.value })} placeholder="Vercel project ID or name" />
                    <input value={draft.teamId} onChange={(event) => updateDraft(definition.id, { teamId: event.target.value })} placeholder="Team ID (optional)" />
                    <input value={draft.gitOrg} onChange={(event) => updateDraft(definition.id, { gitOrg: event.target.value })} placeholder="GitHub organization" />
                    <input value={draft.gitRepo} onChange={(event) => updateDraft(definition.id, { gitRepo: event.target.value })} placeholder="GitHub repository" />
                  </div>
                ) : null}
                <input type="password" value={draft.secret} onChange={(event) => updateDraft(definition.id, { secret: event.target.value })} placeholder={connected ? "Enter a new credential to rotate" : definition.placeholder} />
                <div className="workspace-connector-actions">
                  <button type="button" disabled={busy !== null || !draft.secret.trim()} onClick={() => void save(definition.id)}>
                    {busy === definition.id ? <Loader2 className="spin" size={14} /> : <Check size={14} />} {connected ? "Rotate" : "Connect"}
                  </button>
                  {connected ? <button className="danger" type="button" disabled={busy !== null} onClick={() => void remove(definition.id)}><Trash2 size={14} /> Remove</button> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
