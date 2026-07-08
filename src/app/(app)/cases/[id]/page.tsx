import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { canManageCases, canOverrideOwnership } from "@/lib/auth/rbac";
import { CaseDetail } from "./case-detail";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: caseRow } = await supabase
    .from("awb_cases")
    .select(
      "id, awb, current_status, ownership_status, owner_user_id, urgency, issue_type, remarks, version",
    )
    .eq("id", id)
    .maybeSingle();

  if (!caseRow) {
    notFound();
  }

  const { data: teamMembers } = await supabase
    .from("app_users")
    .select("id, full_name, email")
    .in("role", ["admin", "lead", "operator"])
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const [{ data: updates }, { data: assignments }] = await Promise.all([
    supabase
      .from("case_updates")
      .select("id, update_type, remarks, created_at, updated_by")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("case_assignments")
      .select("id, assignment_type, reason, created_at, to_user_id, from_user_id")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const actorIds = new Set<string>();
  (updates ?? []).forEach((u) => u.updated_by && actorIds.add(u.updated_by));
  (assignments ?? []).forEach((a) => {
    if (a.to_user_id) actorIds.add(a.to_user_id);
    if (a.from_user_id) actorIds.add(a.from_user_id);
  });

  const { data: actors } =
    actorIds.size > 0
      ? await supabase
          .from("app_users")
          .select("id, full_name, email")
          .in("id", Array.from(actorIds))
      : { data: [] };

  const actorMap = new Map(
    (actors ?? []).map((a) => [a.id, a.full_name ?? a.email]),
  );

  const timeline = [
    ...(updates ?? []).map((u) => ({
      id: `update-${u.id}`,
      actorName: u.updated_by ? (actorMap.get(u.updated_by) ?? null) : null,
      action: u.update_type,
      remarks: u.remarks,
      createdAt: u.created_at,
    })),
    ...(assignments ?? []).map((a) => ({
      id: `assignment-${a.id}`,
      actorName: a.to_user_id
        ? (actorMap.get(a.to_user_id) ?? null)
        : a.from_user_id
          ? (actorMap.get(a.from_user_id) ?? null)
          : null,
      action: a.assignment_type,
      remarks: a.reason,
      createdAt: a.created_at,
    })),
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div>
      <CaseDetail
        key={caseRow.version}
        initialCase={caseRow}
        currentUserId={user.id}
        canManage={canManageCases(user.role)}
        canOverride={canOverrideOwnership(user.role)}
        teamMembers={teamMembers ?? []}
        timeline={timeline}
      />
    </div>
  );
}
