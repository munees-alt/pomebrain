-- ====================================================================
-- PHASE 5 SLICE: PER-WORKSPACE MODEL PROVIDER KEYS (ENCRYPTED VIA VAULT)
-- ====================================================================
-- Each workspace can store its own Claude/OpenAI/Gemini API key. The
-- plaintext key is never stored in a plain column - it's encrypted by
-- Supabase Vault (pgsodium-backed) and referenced by secret_id. Only the
-- server (service_role) can decrypt it; end users can set/rotate/delete
-- their own workspace's key but can never read the plaintext back.

CREATE TABLE public.workspace_model_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('claude', 'openai', 'gemini')),
    secret_id UUID NOT NULL,
    key_last4 VARCHAR(8) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_workspace_provider UNIQUE (workspace_id, provider)
);

ALTER TABLE public.workspace_model_keys ENABLE ROW LEVEL SECURITY;

-- Read-only visibility of your own workspace's metadata (never the secret_id's
-- plaintext - that only ever comes back through vault.decrypted_secrets, which
-- these RLS policies never touch).
CREATE POLICY tenant_workspace_model_keys ON public.workspace_model_keys
    FOR SELECT
    USING (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid);

CREATE TRIGGER trigger_workspace_model_keys_updated_at
    BEFORE UPDATE ON public.workspace_model_keys
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Create or rotate a workspace's provider key.
CREATE OR REPLACE FUNCTION public.set_workspace_model_key(
    p_workspace_id UUID,
    p_provider VARCHAR(20),
    p_secret_value TEXT
) RETURNS void AS $$
DECLARE
    v_caller_workspace UUID;
    v_secret_id UUID;
BEGIN
    v_caller_workspace := ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid;

    IF v_caller_workspace IS NULL OR v_caller_workspace <> p_workspace_id THEN
        RAISE EXCEPTION 'Not authorized to set a key for this workspace.';
    END IF;

    IF p_provider NOT IN ('claude', 'openai', 'gemini') THEN
        RAISE EXCEPTION 'Unsupported provider: %', p_provider;
    END IF;

    IF length(trim(p_secret_value)) < 8 THEN
        RAISE EXCEPTION 'Key looks too short to be real.';
    END IF;

    SELECT secret_id INTO v_secret_id
    FROM public.workspace_model_keys
    WHERE workspace_id = p_workspace_id AND provider = p_provider;

    IF v_secret_id IS NOT NULL THEN
        PERFORM vault.update_secret(v_secret_id, p_secret_value);
    ELSE
        v_secret_id := vault.create_secret(p_secret_value, p_workspace_id::text || ':' || p_provider);
    END IF;

    INSERT INTO public.workspace_model_keys (workspace_id, provider, secret_id, key_last4)
    VALUES (p_workspace_id, p_provider, v_secret_id, right(trim(p_secret_value), 4))
    ON CONFLICT (workspace_id, provider)
    DO UPDATE SET secret_id = EXCLUDED.secret_id, key_last4 = EXCLUDED.key_last4, updated_at = timezone('utc', now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- List a workspace's configured providers. Never returns the plaintext key.
CREATE OR REPLACE FUNCTION public.list_workspace_model_keys(p_workspace_id UUID)
RETURNS TABLE (provider VARCHAR(20), key_last4 VARCHAR(8), updated_at TIMESTAMPTZ) AS $$
DECLARE
    v_caller_workspace UUID;
BEGIN
    v_caller_workspace := ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid;

    IF v_caller_workspace IS NULL OR v_caller_workspace <> p_workspace_id THEN
        RAISE EXCEPTION 'Not authorized to view keys for this workspace.';
    END IF;

    RETURN QUERY
    SELECT wmk.provider, wmk.key_last4, wmk.updated_at
    FROM public.workspace_model_keys wmk
    WHERE wmk.workspace_id = p_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Delete a workspace's provider key and its underlying vault secret.
CREATE OR REPLACE FUNCTION public.delete_workspace_model_key(p_workspace_id UUID, p_provider VARCHAR(20))
RETURNS void AS $$
DECLARE
    v_caller_workspace UUID;
    v_secret_id UUID;
BEGIN
    v_caller_workspace := ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid;

    IF v_caller_workspace IS NULL OR v_caller_workspace <> p_workspace_id THEN
        RAISE EXCEPTION 'Not authorized to delete a key for this workspace.';
    END IF;

    SELECT secret_id INTO v_secret_id
    FROM public.workspace_model_keys
    WHERE workspace_id = p_workspace_id AND provider = p_provider;

    IF v_secret_id IS NOT NULL THEN
        DELETE FROM public.workspace_model_keys WHERE workspace_id = p_workspace_id AND provider = p_provider;
        DELETE FROM vault.secrets WHERE id = v_secret_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Server-only decrypt. This is the one function that can ever see the plaintext key,
-- and it is never granted to anon/authenticated - only the server's service_role.
CREATE OR REPLACE FUNCTION public.get_workspace_model_key(p_workspace_id UUID, p_provider VARCHAR(20))
RETURNS TEXT AS $$
DECLARE
    v_secret_id UUID;
    v_secret TEXT;
BEGIN
    SELECT secret_id INTO v_secret_id
    FROM public.workspace_model_keys
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

REVOKE ALL ON FUNCTION public.set_workspace_model_key(UUID, VARCHAR, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_workspace_model_key(UUID, VARCHAR, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.list_workspace_model_keys(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_workspace_model_keys(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_workspace_model_key(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_workspace_model_key(UUID, VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION public.get_workspace_model_key(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_model_key(UUID, VARCHAR) TO service_role;
