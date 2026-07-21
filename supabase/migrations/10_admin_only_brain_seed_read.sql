-- ====================================================================
-- PLATFORM IP PROTECTION: ADMIN-ONLY BRAIN SEED READS
-- ====================================================================
-- The full Brain graph, seed version content, agent manifests, and skill
-- bodies are platform IP. Customers use agents through Crown/App Factory; they
-- must not receive raw prompts, manifests, or skill bodies in the browser.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN coalesce(
        (auth.jwt() -> 'app_metadata' ->> 'pomebrain_role') = 'admin'
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
        false
    );
END;
$$ LANGUAGE plpgsql STABLE SET search_path = '';

DROP POLICY IF EXISTS tenant_seeds ON public.seeds;
DROP POLICY IF EXISTS tenant_seed_versions ON public.seed_versions;
DROP POLICY IF EXISTS tenant_fibres ON public.fibres;

CREATE POLICY admin_read_seeds ON public.seeds
    FOR SELECT
    USING (
        public.is_platform_admin()
        AND workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid
    );

CREATE POLICY admin_write_seeds ON public.seeds
    FOR INSERT
    WITH CHECK (
        public.is_platform_admin()
        AND workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid
    );

CREATE POLICY admin_update_seeds ON public.seeds
    FOR UPDATE
    USING (
        public.is_platform_admin()
        AND workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid
    )
    WITH CHECK (
        public.is_platform_admin()
        AND workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid
    );

CREATE POLICY admin_delete_seeds ON public.seeds
    FOR DELETE
    USING (
        public.is_platform_admin()
        AND workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid
    );

CREATE POLICY admin_read_seed_versions ON public.seed_versions
    FOR SELECT
    USING (
        public.is_platform_admin()
        AND seed_id IN (
            SELECT id FROM public.seeds
            WHERE workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid
        )
    );

CREATE POLICY admin_write_seed_versions ON public.seed_versions
    FOR INSERT
    WITH CHECK (
        public.is_platform_admin()
        AND seed_id IN (
            SELECT id FROM public.seeds
            WHERE workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid
        )
    );

CREATE POLICY admin_update_seed_versions ON public.seed_versions
    FOR UPDATE
    USING (
        public.is_platform_admin()
        AND seed_id IN (
            SELECT id FROM public.seeds
            WHERE workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid
        )
    )
    WITH CHECK (
        public.is_platform_admin()
        AND seed_id IN (
            SELECT id FROM public.seeds
            WHERE workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid
        )
    );

CREATE POLICY admin_delete_seed_versions ON public.seed_versions
    FOR DELETE
    USING (
        public.is_platform_admin()
        AND seed_id IN (
            SELECT id FROM public.seeds
            WHERE workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid
        )
    );

CREATE POLICY admin_read_fibres ON public.fibres
    FOR SELECT
    USING (
        public.is_platform_admin()
        AND workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid
    );

CREATE POLICY admin_write_fibres ON public.fibres
    FOR INSERT
    WITH CHECK (
        public.is_platform_admin()
        AND workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid
    );

CREATE POLICY admin_update_fibres ON public.fibres
    FOR UPDATE
    USING (
        public.is_platform_admin()
        AND workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid
    )
    WITH CHECK (
        public.is_platform_admin()
        AND workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid
    );

CREATE POLICY admin_delete_fibres ON public.fibres
    FOR DELETE
    USING (
        public.is_platform_admin()
        AND workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid
    );

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM anon;
