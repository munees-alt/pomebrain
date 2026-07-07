import { PomebrainShell } from "@/components/pomebrain-shell";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!hasSupabaseServerEnv()) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <PomebrainShell
      userEmail={user.email ?? "Unknown user"}
      workspaceId={
        typeof user.app_metadata?.workspace_id === "string"
          ? user.app_metadata.workspace_id
          : "missing workspace_id"
      }
    />
  );
}
