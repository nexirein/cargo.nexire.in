import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { MyCasesList } from "./my-cases-list";
import { computeNextAction } from "@/lib/cases/next-action";

function applyPhaseFilter(q: any, phase?: string) {
  if (phase === "pre_alert") return q.or("shipment_phase.is.null,shipment_phase.cs.{pre_alert}");
  if (phase === "post_arrival") return q.contains("shipment_phase", ["post_arrival"]);
  return q;
}

export default async function MyCasesPage({
  searchParams,
}: {
  searchParams: Promise<{ phase?: string }>;
}) {
  const { phase } = await searchParams;
  const user = await getCurrentAppUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data: rows } = await applyPhaseFilter(
    supabase
      .from("awb_cases")
      .select("id, awb, current_status, clearance_type, pre_alert_type, ownership_status, issue_type, urgency, do_number, do_collected_at, claimed_at, owner_user_id, version, pending_info, last_called_at, next_action, next_action_sla_at, do_ready_at, boe_filed_at, out_of_charge_at, created_at")
      .eq("owner_user_id", user.id)
      .in("ownership_status", ["claimed", "assigned"])
      .order("claimed_at", { ascending: false }),
    phase,
  );

  const cases = (rows ?? []).map((c: any) => {
    const na = computeNextAction({
      current_status: c.current_status,
      clearance_type: c.clearance_type,
      created_at: c.created_at,
      do_ready_at: c.do_ready_at,
      do_collected_at: c.do_collected_at,
      boe_filed_at: c.boe_filed_at,
    });
    return {
      ...c,
      next_action_id: na.id,
      next_action_label: na.label,
      next_action_group: na.group,
      next_action_sla: na.slaAt,
    };
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">My Console</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your assigned cases — grouped by what needs your attention next.
        </p>
      </div>
      <MyCasesList currentUserId={user.id} cases={cases} />
    </div>
  );
}
