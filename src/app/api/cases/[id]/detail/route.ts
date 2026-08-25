import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const admin = createAdminClient();

    const { data: caseRow } = await admin
      .from("awb_cases")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!caseRow) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    const [emailEventsResult, updatesResult, assignmentsResult, teamMembersResult] = await Promise.all([
      admin
        .from("email_events")
        .select("id, direction, subject, body_clean, sender_email, recipient_emails, created_at")
        .eq("awb", caseRow.awb)
        .order("created_at", { ascending: true }),
      admin
        .from("case_updates")
        .select("id, update_type, remarks, created_at, updated_by")
        .eq("case_id", id)
        .order("created_at", { ascending: false }),
      admin
        .from("case_assignments")
        .select("id, assignment_type, reason, created_at, to_user_id, from_user_id")
        .eq("case_id", id)
        .order("created_at", { ascending: false }),
      admin
        .from("app_users")
        .select("id, full_name, email")
        .in("role", ["admin", "lead", "operator"])
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
    ]);

    const actorIds = new Set<string>();
    (updatesResult.data ?? []).forEach((u) => u.updated_by && actorIds.add(u.updated_by));
    (assignmentsResult.data ?? []).forEach((a) => {
      if (a.to_user_id) actorIds.add(a.to_user_id);
      if (a.from_user_id) actorIds.add(a.from_user_id);
    });

    const teamMembers = teamMembersResult.data ?? [];
    const allUsers = [...teamMembers];
    if (actorIds.size > 0) {
      const { data: extras } = await admin
        .from("app_users")
        .select("id, full_name, email")
        .in("id", Array.from(actorIds).filter((id) => !teamMembers.some((t) => t.id === id)));
      if (extras) allUsers.push(...extras);
    }

    const userMap = new Map(allUsers.map((u) => [u.id, u.full_name ?? u.email]));
    const ownerName = caseRow.owner_user_id ? userMap.get(caseRow.owner_user_id) ?? null : null;

    const timeline = [
      ...(updatesResult.data ?? []).map((u) => ({
        id: `update-${u.id}`,
        actorName: u.updated_by ? (userMap.get(u.updated_by) ?? null) : null,
        action: u.update_type,
        remarks: u.remarks,
        createdAt: u.created_at,
      })),
      ...(assignmentsResult.data ?? []).map((a) => ({
        id: `assignment-${a.id}`,
        actorName: a.to_user_id
          ? (userMap.get(a.to_user_id) ?? null)
          : a.from_user_id
            ? (userMap.get(a.from_user_id) ?? null)
            : null,
        action: a.assignment_type,
        remarks: a.reason,
        createdAt: a.created_at,
      })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return NextResponse.json({
      case: caseRow,
      emailEvents: emailEventsResult.data ?? [],
      timeline,
      teamMembers,
      ownerName,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
