-- ====================================================================
-- PHASE 5 SLICE: PER-WORKSPACE OAUTH CONNECTIONS (ENCRYPTED VIA VAULT)
-- ====================================================================
-- Stores third-party OAuth refresh tokens behind Supabase Vault. Browser
-- clients can only see metadata for their own workspace; only service_role can
-- retrieve decrypted refresh tokens for server-side connector execution.

CREATE TABLE public.workspace_oauth_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    provider VARCHAR(40) NOT NULL CHECK (provider IN ('google_workspace')),
    secret_id UUID NOT NULL,
    account_email TEXT,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    access_token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_workspace_oauth_provider UNIQUE (workspace_id, provider)
);

ALTER TABLE public.workspace_oauth_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_workspace_oauth_connections ON public.workspace_oauth_connections
    FOR SELECT
    USING (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid);

CREATE TRIGGER trigger_workspace_oauth_connections_updated_at
    BEFORE UPDATE ON public.workspace_oauth_connections
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.set_workspace_oauth_connection(
    p_workspace_id UUID,
    p_provider VARCHAR(40),
    p_refresh_token TEXT,
    p_account_email TEXT,
    p_scopes TEXT[],
    p_access_token_expires_at TIMESTAMPTZ
) RETURNS void AS $$
DECLARE
    v_caller_workspace UUID;
    v_secret_id UUID;
BEGIN
    v_caller_workspace := ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid;

    IF v_caller_workspace IS NULL OR v_caller_workspace <> p_workspace_id THEN
        RAISE EXCEPTION 'Not authorized to set a connection for this workspace.';
    END IF;

    IF p_provider NOT IN ('google_workspace') THEN
        RAISE EXCEPTION 'Unsupported OAuth provider: %', p_provider;
    END IF;

    SELECT secret_id INTO v_secret_id
    FROM public.workspace_oauth_connections
    WHERE workspace_id = p_workspace_id AND provider = p_provider;

    IF v_secret_id IS NULL AND nullif(trim(coalesce(p_refresh_token, '')), '') IS NULL THEN
        RAISE EXCEPTION 'A refresh token is required for the first connection.';
    END IF;

    IF nullif(trim(coalesce(p_refresh_token, '')), '') IS NOT NULL THEN
        IF v_secret_id IS NOT NULL THEN
            PERFORM vault.update_secret(v_secret_id, p_refresh_token);
        ELSE
            v_secret_id := vault.create_secret(p_refresh_token, p_workspace_id::text || ':' || p_provider || ':refresh_token');
        END IF;
    END IF;

    INSERT INTO public.workspace_oauth_connections (
        workspace_id,
        provider,
        secret_id,
        account_email,
        scopes,
        access_token_expires_at
    ) VALUES (
        p_workspace_id,
        p_provider,
        v_secret_id,
        nullif(trim(coalesce(p_account_email, '')), ''),
        coalesce(p_scopes, '{}'),
        p_access_token_expires_at
    )
    ON CONFLICT (workspace_id, provider)
    DO UPDATE SET
        secret_id = EXCLUDED.secret_id,
        account_email = EXCLUDED.account_email,
        scopes = EXCLUDED.scopes,
        access_token_expires_at = EXCLUDED.access_token_expires_at,
        updated_at = timezone('utc', now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.list_workspace_oauth_connections(p_workspace_id UUID)
RETURNS TABLE (
    provider VARCHAR(40),
    account_email TEXT,
    scopes TEXT[],
    access_token_expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_caller_workspace UUID;
BEGIN
    v_caller_workspace := ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid;

    IF v_caller_workspace IS NULL OR v_caller_workspace <> p_workspace_id THEN
        RAISE EXCEPTION 'Not authorized to view connections for this workspace.';
    END IF;

    RETURN QUERY
    SELECT
        woc.provider,
        woc.account_email,
        woc.scopes,
        woc.access_token_expires_at,
        woc.updated_at
    FROM public.workspace_oauth_connections woc
    WHERE woc.workspace_id = p_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.delete_workspace_oauth_connection(p_workspace_id UUID, p_provider VARCHAR(40))
RETURNS void AS $$
DECLARE
    v_caller_workspace UUID;
    v_secret_id UUID;
BEGIN
    v_caller_workspace := ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid;

    IF v_caller_workspace IS NULL OR v_caller_workspace <> p_workspace_id THEN
        RAISE EXCEPTION 'Not authorized to delete a connection for this workspace.';
    END IF;

    SELECT secret_id INTO v_secret_id
    FROM public.workspace_oauth_connections
    WHERE workspace_id = p_workspace_id AND provider = p_provider;

    IF v_secret_id IS NOT NULL THEN
        DELETE FROM public.workspace_oauth_connections WHERE workspace_id = p_workspace_id AND provider = p_provider;
        DELETE FROM vault.secrets WHERE id = v_secret_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_workspace_oauth_refresh_token(p_workspace_id UUID, p_provider VARCHAR(40))
RETURNS TEXT AS $$
DECLARE
    v_secret_id UUID;
    v_secret TEXT;
BEGIN
    SELECT secret_id INTO v_secret_id
    FROM public.workspace_oauth_connections
    WHERE workspace_id = p_workspace_id AND provider = p_provider;

    IF v_secret_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE id = v_secret_id;

    RETURN v_secret;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.set_workspace_oauth_connection(UUID, VARCHAR, TEXT, TEXT, TEXT[], TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_workspace_oauth_connection(UUID, VARCHAR, TEXT, TEXT, TEXT[], TIMESTAMPTZ) TO authenticated;

REVOKE ALL ON FUNCTION public.list_workspace_oauth_connections(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_workspace_oauth_connections(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_workspace_oauth_connection(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_workspace_oauth_connection(UUID, VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION public.get_workspace_oauth_refresh_token(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_oauth_refresh_token(UUID, VARCHAR) TO service_role;

REVOKE EXECUTE ON FUNCTION public.set_workspace_oauth_connection(UUID, VARCHAR, TEXT, TEXT, TEXT[], TIMESTAMPTZ) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_workspace_oauth_connections(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_workspace_oauth_connection(UUID, VARCHAR) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workspace_oauth_refresh_token(UUID, VARCHAR) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workspace_oauth_refresh_token(UUID, VARCHAR) FROM authenticated;
