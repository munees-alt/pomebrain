-- ====================================================================
-- PHASE 5 SLICE: UNIVERSAL WORKSPACE CONNECTOR VAULT
-- ====================================================================
-- Generic encrypted connector storage for any future workspace-owned tool:
-- Vercel, Supabase, GitHub, Google Workspace, Sheets, Drive, Fathom, Notion,
-- Slack, Airtable, or another provider added later. Agents receive only named
-- capabilities; raw credentials stay encrypted in Vault.

CREATE TABLE public.workspace_connector_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    provider VARCHAR(80) NOT NULL,
    credential_kind VARCHAR(40) NOT NULL DEFAULT 'api_key',
    secret_id UUID NOT NULL,
    account_label TEXT,
    capability_ids TEXT[] NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_workspace_connector_secret UNIQUE (workspace_id, provider, credential_kind),
    CONSTRAINT provider_slug_format CHECK (provider ~ '^[a-z0-9][a-z0-9_\\-]{1,79}$'),
    CONSTRAINT credential_kind_format CHECK (credential_kind ~ '^[a-z0-9][a-z0-9_\\-]{1,39}$')
);

ALTER TABLE public.workspace_connector_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_workspace_connector_secrets ON public.workspace_connector_secrets
    FOR SELECT
    USING (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid);

CREATE TRIGGER trigger_workspace_connector_secrets_updated_at
    BEFORE UPDATE ON public.workspace_connector_secrets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.set_workspace_connector_secret(
    p_workspace_id UUID,
    p_provider VARCHAR(80),
    p_credential_kind VARCHAR(40),
    p_secret_value TEXT,
    p_account_label TEXT,
    p_capability_ids TEXT[],
    p_metadata JSONB
) RETURNS void AS $$
DECLARE
    v_caller_workspace UUID;
    v_secret_id UUID;
BEGIN
    v_caller_workspace := ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid;

    IF v_caller_workspace IS NULL OR v_caller_workspace <> p_workspace_id THEN
        RAISE EXCEPTION 'Not authorized to set a connector secret for this workspace.';
    END IF;

    IF p_provider !~ '^[a-z0-9][a-z0-9_\-]{1,79}$' THEN
        RAISE EXCEPTION 'Invalid connector provider slug: %', p_provider;
    END IF;

    IF p_credential_kind !~ '^[a-z0-9][a-z0-9_\-]{1,39}$' THEN
        RAISE EXCEPTION 'Invalid credential kind: %', p_credential_kind;
    END IF;

    IF length(trim(p_secret_value)) < 8 THEN
        RAISE EXCEPTION 'Connector secret looks too short to be real.';
    END IF;

    SELECT secret_id INTO v_secret_id
    FROM public.workspace_connector_secrets
    WHERE workspace_id = p_workspace_id
      AND provider = p_provider
      AND credential_kind = p_credential_kind;

    IF v_secret_id IS NOT NULL THEN
        PERFORM vault.update_secret(v_secret_id, p_secret_value);
    ELSE
        v_secret_id := vault.create_secret(
            p_secret_value,
            p_workspace_id::text || ':' || p_provider || ':' || p_credential_kind
        );
    END IF;

    INSERT INTO public.workspace_connector_secrets (
        workspace_id,
        provider,
        credential_kind,
        secret_id,
        account_label,
        capability_ids,
        metadata
    ) VALUES (
        p_workspace_id,
        p_provider,
        p_credential_kind,
        v_secret_id,
        nullif(trim(coalesce(p_account_label, '')), ''),
        coalesce(p_capability_ids, '{}'),
        coalesce(p_metadata, '{}'::jsonb)
    )
    ON CONFLICT (workspace_id, provider, credential_kind)
    DO UPDATE SET
        secret_id = EXCLUDED.secret_id,
        account_label = EXCLUDED.account_label,
        capability_ids = EXCLUDED.capability_ids,
        metadata = EXCLUDED.metadata,
        updated_at = timezone('utc', now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.list_workspace_connector_secrets(p_workspace_id UUID)
RETURNS TABLE (
    provider VARCHAR(80),
    credential_kind VARCHAR(40),
    account_label TEXT,
    capability_ids TEXT[],
    metadata JSONB,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_caller_workspace UUID;
BEGIN
    v_caller_workspace := ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid;

    IF v_caller_workspace IS NULL OR v_caller_workspace <> p_workspace_id THEN
        RAISE EXCEPTION 'Not authorized to view connector secrets for this workspace.';
    END IF;

    RETURN QUERY
    SELECT
        wcs.provider,
        wcs.credential_kind,
        wcs.account_label,
        wcs.capability_ids,
        wcs.metadata,
        wcs.updated_at
    FROM public.workspace_connector_secrets wcs
    WHERE wcs.workspace_id = p_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.delete_workspace_connector_secret(
    p_workspace_id UUID,
    p_provider VARCHAR(80),
    p_credential_kind VARCHAR(40)
) RETURNS void AS $$
DECLARE
    v_caller_workspace UUID;
    v_secret_id UUID;
BEGIN
    v_caller_workspace := ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid;

    IF v_caller_workspace IS NULL OR v_caller_workspace <> p_workspace_id THEN
        RAISE EXCEPTION 'Not authorized to delete a connector secret for this workspace.';
    END IF;

    SELECT secret_id INTO v_secret_id
    FROM public.workspace_connector_secrets
    WHERE workspace_id = p_workspace_id
      AND provider = p_provider
      AND credential_kind = p_credential_kind;

    IF v_secret_id IS NOT NULL THEN
        DELETE FROM public.workspace_connector_secrets
        WHERE workspace_id = p_workspace_id
          AND provider = p_provider
          AND credential_kind = p_credential_kind;

        DELETE FROM vault.secrets WHERE id = v_secret_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_workspace_connector_secret(
    p_workspace_id UUID,
    p_provider VARCHAR(80),
    p_credential_kind VARCHAR(40)
) RETURNS TEXT AS $$
DECLARE
    v_secret_id UUID;
    v_secret TEXT;
BEGIN
    SELECT secret_id INTO v_secret_id
    FROM public.workspace_connector_secrets
    WHERE workspace_id = p_workspace_id
      AND provider = p_provider
      AND credential_kind = p_credential_kind;

    IF v_secret_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE id = v_secret_id;

    RETURN v_secret;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.set_workspace_connector_secret(UUID, VARCHAR, VARCHAR, TEXT, TEXT, TEXT[], JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_workspace_connector_secret(UUID, VARCHAR, VARCHAR, TEXT, TEXT, TEXT[], JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.list_workspace_connector_secrets(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_workspace_connector_secrets(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_workspace_connector_secret(UUID, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_workspace_connector_secret(UUID, VARCHAR, VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION public.get_workspace_connector_secret(UUID, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_connector_secret(UUID, VARCHAR, VARCHAR) TO service_role;

REVOKE EXECUTE ON FUNCTION public.set_workspace_connector_secret(UUID, VARCHAR, VARCHAR, TEXT, TEXT, TEXT[], JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_workspace_connector_secrets(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_workspace_connector_secret(UUID, VARCHAR, VARCHAR) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workspace_connector_secret(UUID, VARCHAR, VARCHAR) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workspace_connector_secret(UUID, VARCHAR, VARCHAR) FROM authenticated;
