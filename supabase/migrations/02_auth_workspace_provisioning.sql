-- Pomebrain auth substrate: every signed-up user gets a workspace_id in app_metadata.

CREATE TABLE public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_select_for_member ON public.workspaces
    FOR SELECT
    USING (id = ((auth.jwt() -> 'app_metadata') ->> 'workspace_id')::uuid);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_workspace_id UUID;
BEGIN
    INSERT INTO public.workspaces (name, owner_id)
    VALUES (
        COALESCE(NEW.email, 'Pomebrain') || ' Workspace',
        NEW.id
    )
    RETURNING id INTO v_workspace_id;

    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('workspace_id', v_workspace_id::text)
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

