import { PomebrainShell } from "@/components/pomebrain-shell";
import { isPlatformAdmin } from "@/lib/admin";
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
      isAdmin={isPlatformAdmin(user.email, user.app_metadata)}
    />
  );
}
