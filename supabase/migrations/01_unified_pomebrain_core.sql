-- ====================================================================
-- PHASE 1 & 4 UNIFIED POMEBRAIN CORE SCHEMA (corrected)
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- 0. GLOBAL HELPERS ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Generic immutable audit writer. Logs before/after state on any change.
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_workspace_id UUID;
BEGIN
    v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
    INSERT INTO public.audit_events (
        workspace_id, actor_id, action_type, target_table, target_id,
        state_before, state_after
    ) VALUES (
        v_workspace_id,
        auth.uid(),
        TG_TABLE_NAME || '.' || lower(TG_OP),
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE '{}'::jsonb END,
        CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN to_jsonb(NEW) ELSE '{}'::jsonb END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. THE BRAIN SPINE (PHASE 1: GRAPH CORE) ---------------------------
CREATE TABLE public.seeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    slug VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,               -- agent, skill, tool, knowledge, etc.
    current_version_id UUID,                  -- FK added after seed_versions exists
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_workspace_slug_type UNIQUE (workspace_id, slug, type)
);

CREATE TRIGGER trigger_seeds_updated_at
    BEFORE UPDATE ON public.seeds
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.seed_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seed_id UUID REFERENCES public.seeds(id) ON DELETE CASCADE NOT NULL,
    version_number INT NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, review, approved, deprecated, rejected, archived, superseded
    content JSONB NOT NULL,
    embedding vector(1536),
    checksum VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_seed_version UNIQUE (seed_id, version_number)
);

-- Now wire the approved-head pointer (deferred FK avoids circular create).
ALTER TABLE public.seeds
    ADD CONSTRAINT fk_seeds_current_version
    FOREIGN KEY (current_version_id) REFERENCES public.seed_versions(id);

CREATE TABLE public.fibres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    source_seed_id UUID REFERENCES public.seeds(id) ON DELETE CASCADE NOT NULL,
    target_seed_id UUID REFERENCES public.seeds(id) ON DELETE CASCADE NOT NULL,
    -- Optional version pinning for SUPERSEDES / LEARNED_FROM precision:
    source_version_id UUID REFERENCES public.seed_versions(id),
    target_version_id UUID REFERENCES public.seed_versions(id),
    relationship_type VARCHAR(50) NOT NULL,   -- USES, REQUIRES, SUPERSEDES, LEARNED_FROM, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_workspace_edge UNIQUE (workspace_id, source_seed_id, target_seed_id, relationship_type)
);

-- 2. THE APP FACTORY RUNTIME LAYER (PHASE 4) -------------------------
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TRIGGER trigger_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.project_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'idle',
    active_orchestrator_version_id UUID REFERENCES public.seed_versions(id) NOT NULL,
    total_token_cost NUMERIC(10, 4) DEFAULT 0.0000,
    execution_context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TRIGGER trigger_project_runs_updated_at
    BEFORE UPDATE ON public.project_runs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.build_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    run_id UUID REFERENCES public.project_runs(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_agent_version_id UUID REFERENCES public.seed_versions(id) NOT NULL,
    dependencies UUID[] DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    output_logs TEXT,
    sequence_order INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TRIGGER trigger_build_tasks_updated_at
    BEFORE UPDATE ON public.build_tasks
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.approval_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    run_id UUID REFERENCES public.project_runs(id) ON DELETE CASCADE NOT NULL,
    task_id UUID REFERENCES public.build_tasks(id) ON DELETE CASCADE NOT NULL,
    requested_capability VARCHAR(100) NOT NULL,
    proposed_payload JSONB NOT NULL,
    risk_level VARCHAR(50) NOT NULL DEFAULT 'medium',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TRIGGER trigger_approval_queue_updated_at
    BEFORE UPDATE ON public.approval_queue
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. IMMUTABLE AUDIT LEDGER ------------------------------------------
CREATE TABLE public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    actor_id UUID,
    action_type VARCHAR(100) NOT NULL,
    target_table VARCHAR(100) NOT NULL,
    target_id UUID NOT NULL,
    state_before JSONB DEFAULT '{}'::jsonb,
    state_after JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Wire the audit writer onto the state-mutating tables.
CREATE TRIGGER audit_project_runs
    AFTER INSERT OR UPDATE OR DELETE ON public.project_runs
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_approval_queue
    AFTER INSERT OR UPDATE OR DELETE ON public.approval_queue
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_build_tasks
    AFTER INSERT OR UPDATE OR DELETE ON public.build_tasks
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 4. ROW LEVEL SECURITY ----------------------------------------------
ALTER TABLE public.seeds           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seed_versions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fibres          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_runs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build_tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_queue  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events    ENABLE ROW LEVEL SECURITY;

-- Helper expression for current workspace:
--   ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid

-- Full-access tenant policies (USING + WITH CHECK closes the write leak).
CREATE POLICY tenant_seeds ON public.seeds
    FOR ALL
    USING (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid)
    WITH CHECK (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid);

CREATE POLICY tenant_seed_versions ON public.seed_versions
    FOR ALL
    USING (seed_id IN (SELECT id FROM public.seeds
        WHERE workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid))
    WITH CHECK (seed_id IN (SELECT id FROM public.seeds
        WHERE workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid));

CREATE POLICY tenant_fibres ON public.fibres
    FOR ALL
    USING (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid)
    WITH CHECK (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid);

CREATE POLICY tenant_projects ON public.projects
    FOR ALL
    USING (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid)
    WITH CHECK (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid);

CREATE POLICY tenant_project_runs ON public.project_runs
    FOR ALL
    USING (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid)
    WITH CHECK (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid);

CREATE POLICY tenant_build_tasks ON public.build_tasks
    FOR ALL
    USING (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid)
    WITH CHECK (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid);

CREATE POLICY tenant_approval_queue ON public.approval_queue
    FOR ALL
    USING (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid)
    WITH CHECK (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid);

-- Audit ledger: INSERT + SELECT only. No UPDATE / no DELETE = immutable.
CREATE POLICY audit_read ON public.audit_events
    FOR SELECT
    USING (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid);

CREATE POLICY audit_insert ON public.audit_events
    FOR INSERT
    WITH CHECK (workspace_id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid);
-- Deliberately NO update/delete policy: the ledger cannot be altered.
