"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, Mail, Trash2 } from "lucide-react";
import { createSupabaseBrowserClient, hasSupabaseBrowserEnv } from "@/lib/supabase-client";

type OAuthConnectionRow = {
  provider: "google_workspace";
  account_email: string | null;
  scopes: string[] | null;
  access_token_expires_at: string | null;
  updated_at: string;
};

type GoogleWorkspacePanelProps = {
  envReady: boolean;
};

export function GoogleWorkspacePanel({ envReady }: GoogleWorkspacePanelProps) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [connection, setConnection] = useState<OAuthConnectionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("connector_error");
  });
  const [notice, setNotice] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("connector_status") === "google_connected"
      ? "Google Workspace connected."
      : null;
  });

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

        const { data, error: rpcError } = await supabase.rpc("list_workspace_oauth_connections", {
          p_workspace_id: wsId,
        });
        if (rpcError) throw rpcError;
        const rows = (data ?? []) as OAuthConnectionRow[];
        if (mounted) setConnection(rows.find((row) => row.provider === "google_workspace") ?? null);
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "Unable to load Google connection.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  async function disconnect() {
    if (!workspaceId) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: rpcError } = await supabase.rpc("delete_workspace_oauth_connection", {
        p_workspace_id: workspaceId,
        p_provider: "google_workspace",
      });
      if (rpcError) throw rpcError;
      setConnection(null);
      setNotice("Google Workspace disconnected.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not disconnect Google Workspace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel-card model-keys-card">
      <div className="panel-heading">
        <div>
          <span className="section-label">GOOGLE WORKSPACE</span>
          <h2>Drive and Gmail OAuth</h2>
        </div>
        <div className="graph-legend"><Mail size={14} /> Per-workspace connection</div>
      </div>
      <p className="model-keys-subtitle">
        Connect a Google account so App Factory can request scoped Drive and Gmail capabilities without storing
        raw OAuth tokens in the browser.
      </p>

      {loading ? <p className="model-keys-status">Loading Google connection...</p> : null}
      {error ? <p className="login-message error">{error}</p> : null}
      {notice ? <p className="login-message success">{notice}</p> : null}

      {!loading ? (
        <div className="model-key-rows">
          <div className="model-key-row">
            <div className="model-key-row-heading">
              <span className="model-key-icon"><Mail size={14} /></span>
              <strong>{connection?.account_email ?? "Google Workspace"}</strong>
              {connection ? (
                <span className="model-key-configured"><Check size={12} /> Connected</span>
              ) : (
                <span className="model-key-unconfigured">{envReady ? "Not connected" : "Missing env"}</span>
              )}
            </div>
            {connection ? (
              <p className="model-keys-status">
                {connection.scopes?.length ?? 0} scopes authorized. Updated {new Date(connection.updated_at).toLocaleString()}.
              </p>
            ) : null}
            <div className="model-key-row-controls">
              <a className="outline-action model-key-save google-connect-link" href="/api/connectors/google/start" aria-disabled={!envReady}>
                <ExternalLink size={14} />
                {connection ? "Reconnect" : "Connect Google"}
              </a>
              {connection ? (
                <button type="button" className="model-key-delete" disabled={busy} onClick={() => void disconnect()} aria-label="Disconnect Google Workspace">
                  {busy ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
