"use client";

import { useEffect, useState } from "react";
import { Check, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { createSupabaseBrowserClient, hasSupabaseBrowserEnv } from "@/lib/supabase-client";

type Provider = "claude" | "openai" | "gemini";

type KeyRow = { provider: Provider; key_last4: string; updated_at: string };

const PROVIDERS: { id: Provider; label: string; placeholder: string }[] = [
  { id: "claude", label: "Claude (Anthropic)", placeholder: "sk-ant-..." },
  { id: "openai", label: "OpenAI", placeholder: "sk-..." },
  { id: "gemini", label: "Gemini (Google)", placeholder: "AIza..." },
];

export function ModelKeysPanel() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [drafts, setDrafts] = useState<Record<Provider, string>>({ claude: "", openai: "", gemini: "" });
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (!hasSupabaseBrowserEnv()) throw new Error("Missing Supabase browser env.");
        const supabase = createSupabaseBrowserClient();
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const wsId = sessionData.session?.user.app_metadata?.workspace_id as string | undefined;
        if (!wsId) throw new Error("No workspace on this session. Sign in again.");
        if (!mounted) return;
        setWorkspaceId(wsId);

        const { data, error: rpcError } = await supabase.rpc("list_workspace_model_keys", { p_workspace_id: wsId });
        if (rpcError) throw rpcError;
        if (mounted) setRows((data ?? []) as KeyRow[]);
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "Unable to load your model keys.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  async function saveKey(provider: Provider) {
    const value = drafts[provider].trim();
    if (!workspaceId || !value) return;

    setBusyProvider(provider);
    setError(null);
    setNotice(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: rpcError } = await supabase.rpc("set_workspace_model_key", {
        p_workspace_id: workspaceId,
        p_provider: provider,
        p_secret_value: value,
      });
      if (rpcError) throw rpcError;

      const { data } = await supabase.rpc("list_workspace_model_keys", { p_workspace_id: workspaceId });
      setRows((data ?? []) as KeyRow[]);
      setDrafts((current) => ({ ...current, [provider]: "" }));
      setNotice(`${provider} key saved and encrypted.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save that key.");
    } finally {
      setBusyProvider(null);
    }
  }

  async function deleteKey(provider: Provider) {
    if (!workspaceId) return;
    setBusyProvider(provider);
    setError(null);
    setNotice(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: rpcError } = await supabase.rpc("delete_workspace_model_key", {
        p_workspace_id: workspaceId,
        p_provider: provider,
      });
      if (rpcError) throw rpcError;
      setRows((current) => current.filter((row) => row.provider !== provider));
      setNotice(`${provider} key removed.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove that key.");
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <section className="panel-card model-keys-card">
      <div className="panel-heading">
        <div>
          <span className="section-label">YOUR MODEL KEYS</span>
          <h2>Bring your own API keys</h2>
        </div>
        <div className="graph-legend"><ShieldCheck size={14} /> Encrypted via Supabase Vault</div>
      </div>
      <p className="model-keys-subtitle">
        Saved here, your key is encrypted at rest and can only be decrypted by Pomebrain&apos;s server when routing a
        model call for your workspace - never by other users, and never returned to any browser, including yours.
      </p>

      {loading ? <p className="model-keys-status">Loading your keys…</p> : null}
      {error ? <p className="login-message error">{error}</p> : null}
      {notice ? <p className="login-message success">{notice}</p> : null}

      {!loading && workspaceId ? (
        <div className="model-key-rows">
          {PROVIDERS.map(({ id, label, placeholder }) => {
            const configured = rows.find((row) => row.provider === id);
            const busy = busyProvider === id;

            return (
              <div key={id} className="model-key-row">
                <div className="model-key-row-heading">
                  <span className="model-key-icon"><KeyRound size={14} /></span>
                  <strong>{label}</strong>
                  {configured ? (
                    <span className="model-key-configured"><Check size={12} /> •••• {configured.key_last4}</span>
                  ) : (
                    <span className="model-key-unconfigured">Not configured</span>
                  )}
                </div>
                <div className="model-key-row-controls">
                  <input
                    type="password"
                    value={drafts[id]}
                    onChange={(event) => setDrafts((current) => ({ ...current, [id]: event.target.value }))}
                    placeholder={configured ? "Enter a new key to rotate it" : placeholder}
                    aria-label={`${label} API key`}
                  />
                  <button
                    type="button"
                    className="outline-action model-key-save"
                    disabled={busy || !drafts[id].trim()}
                    onClick={() => void saveKey(id)}
                  >
                    {busy ? <Loader2 className="spin" size={14} /> : <Check size={14} />}
                    Save
                  </button>
                  {configured ? (
                    <button
                      type="button"
                      className="model-key-delete"
                      disabled={busy}
                      onClick={() => void deleteKey(id)}
                      aria-label={`Remove ${label} key`}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
