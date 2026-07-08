import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "lead" | "operator" | "reviewer" | "viewer";

export interface AppUser {
  id: string;
  authUserId: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  teamName: string | null;
  isActive: boolean;
}

// Cached per-request: every server component/route handler that calls this
// during the same request reuses one lookup instead of re-querying.
export const getCurrentAppUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("app_users")
    .select("id, auth_user_id, email, full_name, role, team_name, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    authUserId: data.auth_user_id,
    email: data.email,
    fullName: data.full_name,
    role: data.role as AppRole,
    teamName: data.team_name,
    isActive: data.is_active,
  };
});

export const hasActiveMailboxConfig = cache(
  async (appUserId: string): Promise<boolean> => {
    const supabase = await createClient();
    const { count } = await supabase
      .from("mailbox_configs")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", appUserId)
      .eq("is_active", true);
    return (count ?? 0) > 0;
  },
);
