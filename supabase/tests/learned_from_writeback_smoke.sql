-- Pomebrain smoke test: prove the schema supports Brain write-back.
-- Run after supabase/migrations/01_unified_pomebrain_core.sql on a disposable Supabase database.
-- This test intentionally creates one fibre with relationship_type = 'LEARNED_FROM'.

DO $$
DECLARE
    v_workspace_id UUID := gen_random_uuid();
    v_project_seed_id UUID;
    v_lesson_seed_id UUID;
    v_project_version_id UUID;
    v_lesson_version_id UUID;
    v_count INT;
BEGIN
    INSERT INTO public.seeds (workspace_id, slug, type)
    VALUES (v_workspace_id, 'smoke-generated-app', 'project')
    RETURNING id INTO v_project_seed_id;

    INSERT INTO public.seed_versions (seed_id, version_number, status, content, checksum)
    VALUES (
        v_project_seed_id,
        1,
        'approved',
        '{"name":"Smoke Generated App"}'::jsonb,
        'smoke_project_checksum'
    )
    RETURNING id INTO v_project_version_id;

    UPDATE public.seeds
    SET current_version_id = v_project_version_id
    WHERE id = v_project_seed_id;

    INSERT INTO public.seeds (workspace_id, slug, type)
    VALUES (v_workspace_id, 'smoke-run-lesson', 'knowledge')
    RETURNING id INTO v_lesson_seed_id;

    INSERT INTO public.seed_versions (seed_id, version_number, status, content, checksum)
    VALUES (
        v_lesson_seed_id,
        1,
        'approved',
        '{"lesson":"The generated app created a reusable learning seed."}'::jsonb,
        'smoke_lesson_checksum'
    )
    RETURNING id INTO v_lesson_version_id;

    UPDATE public.seeds
    SET current_version_id = v_lesson_version_id
    WHERE id = v_lesson_seed_id;

    INSERT INTO public.fibres (
        workspace_id,
        source_seed_id,
        target_seed_id,
        source_version_id,
        target_version_id,
        relationship_type
    )
    VALUES (
        v_workspace_id,
        v_lesson_seed_id,
        v_project_seed_id,
        v_lesson_version_id,
        v_project_version_id,
        'LEARNED_FROM'
    );

    SELECT COUNT(*)
    INTO v_count
    FROM public.fibres
    WHERE workspace_id = v_workspace_id
      AND relationship_type = 'LEARNED_FROM';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'LEARNED_FROM write-back smoke test failed: expected 1 row, got %', v_count;
    END IF;
END $$;
