import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WizardSteps } from "@/components/batches/wizard-steps";
import { assertStep } from "@/lib/batches/guard-step";
import { CLEARANCE_DISPLAY } from "@/lib/cases/clearance-type";
import { ReviewPanel } from "./review-panel";
import { ConsolReviewPanel } from "./consol-review-panel";
import { ReadyItemRow } from "./ready-item-row";
import { AiDraftPanel } from "./ai-draft-panel";

interface BatchItem {
  id: string;
  awb: string;
  consignee_name: string | null;
  consignee_email: string | null;
  clearance_type: string | null;
  template_id: string | null;
  shipment_data: Record<string, string>;
  send_status: string;
}

interface ResolvedItem extends BatchItem {
  resolvedFrom: "master" | null;
  resolvedLabel: string | null;
}

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export default async function BatchReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("batch_runs")
    .select("id, run_name, status, phase, pre_alert_type, metadata, total_rows")
    .eq("id", id)
    .maybeSingle();

  if (!batch) {
    notFound();
  }

  assertStep(id, "review", batch.status, batch.phase ?? "pre_alert");

  const phase = (batch.phase ?? "pre_alert") as string;
  const preAlertType = (batch.pre_alert_type ?? "u_bond") as string;
  const isConsol = phase === "pre_alert" && preAlertType === "consol";
  const admin = createAdminClient();

  const { data: items } = await admin
    .from("batch_items")
    .select("id, awb, consignee_name, consignee_email, clearance_type, template_id, shipment_data, send_status")
    .eq("batch_run_id", id);

  const { data: brokerMaster } = await admin
    .from("broker_master")
    .select("company_name, company_name_normalized, broker_type, broker_name");

  const allItems = items ?? [];

  // Fetch call_tasks for this batch to show call status
  const batchItemIds = allItems.map((i) => i.id);
  const { data: callTasks } = batchItemIds.length > 0
    ? await admin
        .from("call_tasks")
        .select("id, batch_item_id, awb, status, call_type")
        .in("batch_item_id", batchItemIds)
    : { data: [] };
  const callByItemId = new Map<string, { id: string; status: string; callType: string }>();
  for (const ct of callTasks ?? []) {
    if (!callByItemId.has(ct.batch_item_id)) {
      callByItemId.set(ct.batch_item_id, { id: ct.id, status: ct.status, callType: ct.call_type });
    }
  }

  // Fetch AI drafts for this batch
  const { data: aiDrafts } = await admin
    .from("ai_drafts")
    .select("id, subject, body_html, body_text, confidence, status, trigger_type, trigger_reason, created_at, template_id, edited_subject, edited_body, rejection_reason")
    .eq("batch_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const masterMap = new Map<string, { broker_type: string; broker_name: string | null; company_name: string }>();
  for (const row of brokerMaster ?? []) {
    const existing = masterMap.get(row.company_name_normalized);
    if (!existing) {
      masterMap.set(row.company_name_normalized, {
        broker_type: row.broker_type,
        broker_name: row.broker_name,
        company_name: row.company_name,
      });
    }
  }

  const ready: ResolvedItem[] = [];
  const needsAttention: ResolvedItem[] = [];
  const consolReady: ResolvedItem[] = [];
  const consolNeedsAttention: ResolvedItem[] = [];

  for (const item of allItems) {
    const resolved: ResolvedItem = { ...item, resolvedFrom: null, resolvedLabel: null };
    const ct = item.clearance_type;

    if (isConsol) {
      if (ct === "nfbrk") {
        resolved.resolvedLabel = "NFBRK — confirmed";
        consolReady.push(resolved);
      } else if (ct === "febrk-jeena" || ct === "febrk-sunimpex") {
        resolved.resolvedLabel = ct === "febrk-jeena" ? "FEBRK-Jeena" : "FEBRK-Sunimpex";
        consolReady.push(resolved);
      } else if (ct === "hold") {
        resolved.resolvedLabel = "Hold";
        consolReady.push(resolved);
      } else {
        consolNeedsAttention.push(resolved);
      }
      continue;
    }

    // ── uBond classification (existing logic) ──
    if (ct === "nfbrk") {
      resolved.resolvedLabel = "NFBRK — always ready";
      ready.push(resolved);
      continue;
    }

    if (ct === "febrk-jeena" || ct === "febrk-sunimpex") {
      resolved.resolvedLabel = ct === "febrk-jeena" ? "FEBRK-Jeena" : "FEBRK-Sunimpex";
      ready.push(resolved);
      continue;
    }

    if (ct === "hold") {
      resolved.resolvedLabel = "Hold";
      ready.push(resolved);
      continue;
    }

    if (ct === "calling" || ct === "febrk") {
      const companyName = item.consignee_name ?? "";
      const normalized = normalize(companyName);
      const masterMatch = masterMap.get(normalized);

      if (masterMatch) {
        const resolvedType = masterMatch.broker_type;
        const label = resolvedType === "febrk-jeena" ? "FEBRK-Jeena" : "FEBRK-Sunimpex";
        resolved.clearance_type = resolvedType;
        resolved.resolvedFrom = "master";
        resolved.resolvedLabel = `✅ Resolved from master → ${label}`;
        ready.push(resolved);
      } else {
        needsAttention.push(resolved);
      }
      continue;
    }

    resolved.resolvedLabel = ct ?? "Unknown";
    ready.push(resolved);
  }

  const readyCount = ready.length;
  const needsCount = needsAttention.length;
  const resolvedFromMasterCount = ready.filter((r) => r.resolvedFrom === "master").length;
  const activeCallCount = needsAttention.filter((n) => callByItemId.has(n.id)).length;

  // AWBs with completed AI calls
  const doneCallAwbs = new Set(
    (callTasks ?? []).filter((t) => t.status === "done" || t.status === "completed").map((t) => t.awb),
  );

  // Split needs attention into sub-groups for column layout
  const callingNeeds = needsAttention.filter((i) => i.clearance_type === "calling");
  const febrkNeeds = needsAttention.filter((i) => i.clearance_type === "febrk");
  const unresolvedNeeds = needsAttention.filter((i) => !i.clearance_type);
  const needsGroupCount = [callingNeeds.length > 0, febrkNeeds.length > 0, unresolvedNeeds.length > 0].filter(Boolean).length;

  // Consol metrics
  const consolReadyCount = consolReady.length;
  const consolNeedsCount = consolNeedsAttention.length;

  return (
    <div>
      <style>{`@keyframes slideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <WizardSteps current="review" phase={batch.phase ?? "pre_alert"} preAlertType={batch.pre_alert_type} />

      {isConsol ? (
        <>
          {/* Consol dashboard */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <SummaryCard label="Total items" value={allItems.length} />
            <SummaryCard label="Ready" value={consolReadyCount} color={consolReadyCount > 0 ? "emerald" : "slate"} />
            <SummaryCard label="Needs confirmation" value={consolNeedsCount} color={consolNeedsCount > 0 ? "amber" : "emerald"} />
            <SummaryCard
              label="Courier flagged"
              value={batch.metadata?.courier_move_candidates?.length ?? 0}
              color={(batch.metadata?.courier_move_candidates?.length ?? 0) > 0 ? "amber" : "slate"}
            />
          </div>

          {/* Consol ready panel */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 bg-white">
              <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-3">
                <h2 className="text-sm font-semibold text-emerald-800">
                  ✅ Ready — {consolReadyCount} AWB{consolReadyCount !== 1 ? "s" : ""}
                </h2>
                <p className="text-xs text-emerald-600">
                  These will proceed through preview and send.
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {consolReady.map((item, i) => (
                  <ReadyItemRow
                    key={item.id}
                    item={item}
                    index={i}
                    hasAiCall={doneCallAwbs.has(item.awb)}
                    batchRunId={id}
                  />
                ))}
                {consolReady.length === 0 ? (
                  <p className="px-5 py-6 text-center text-sm text-slate-400">
                    No items ready yet.
                  </p>
                ) : null}
              </div>
            </div>

            {consolNeedsAttention.length > 0 && (
              <ConsolReviewPanel items={consolNeedsAttention} batchRunId={id} />
            )}
          </div>
        </>
      ) : (
        <>
          {/* uBond dashboard */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <SummaryCard label="Total items" value={allItems.length} />
            <SummaryCard label="Resolved from master" value={resolvedFromMasterCount} color={resolvedFromMasterCount > 0 ? "emerald" : "slate"} />
            <SummaryCard
              label="AI calling"
              value={activeCallCount}
              color={activeCallCount > 0 ? "amber" : "slate"}
              link={activeCallCount > 0 ? { href: `/calls?call_type=confirmation&phase=pre_alert`, label: "View details →" } : undefined}
            />
            <SummaryCard label="Needs attention" value={needsCount} color={needsCount > 0 ? "red" : "emerald"} />
          </div>

          {/* uBond panels */}
          <div className={`mt-6 grid grid-cols-1 gap-6 ${needsGroupCount > 0 ? "lg:grid-cols-2 xl:grid-cols-3" : ""}`}>
            <div className="rounded-xl border border-emerald-200 bg-white">
              <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-3">
                <h2 className="text-sm font-semibold text-emerald-800">
                  ✅ Ready — {readyCount} AWB{readyCount !== 1 ? "s" : ""}
                </h2>
                <p className="text-xs text-emerald-600">
                  These will proceed through attachments and send automatically.
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {ready.map((item, i) => (
                  <ReadyItemRow
                    key={item.id}
                    item={item}
                    index={i}
                    hasAiCall={doneCallAwbs.has(item.awb)}
                    batchRunId={id}
                  />
                ))}
                {ready.length === 0 ? (
                  <p className="px-5 py-6 text-center text-sm text-slate-400">
                    No items ready yet.
                  </p>
                ) : null}
              </div>
            </div>

            {callingNeeds.length > 0 && (
              <ReviewPanel items={callingNeeds} batchRunId={id} callByItemId={callByItemId} />
            )}

            {febrkNeeds.length > 0 || unresolvedNeeds.length > 0 ? (
              <div className="flex flex-col gap-4">
                {febrkNeeds.length > 0 && (
                  <ReviewPanel items={febrkNeeds} batchRunId={id} callByItemId={callByItemId} />
                )}
                {unresolvedNeeds.length > 0 && (
                  <ReviewPanel items={unresolvedNeeds} batchRunId={id} callByItemId={callByItemId} />
                )}
              </div>
            ) : null}
          </div>
        </>
      )}

      {/* AI Draft panel */}
      <div className="mt-6">
        <AiDraftPanel batchId={id} initialDrafts={aiDrafts ?? []} />
      </div>

      <div className="mt-8 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4">
        <p className="text-sm text-slate-500">
          {isConsol
            ? (consolNeedsCount > 0
                ? `${consolNeedsCount} item(s) need confirmation before proceeding.`
                : "All items resolved. Proceed to preview.")
            : (needsCount > 0
                ? `${needsCount} item(s) will be assigned to AI calling if not resolved manually.`
                : "All items resolved. Proceed to upload attachments.")}
        </p>
        <div className="flex gap-3">
          <Link
            href={`/batches/${id}/mapping`}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Back to mapping
          </Link>
          <Link
            href={`/batches/${id}/${isConsol ? "preview" : "attachments"}`}
            className="rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {isConsol ? "Proceed to preview" : "Proceed to attachments"}
          </Link>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color = "slate",
  link,
}: {
  label: string;
  value: number;
  color?: "slate" | "emerald" | "amber" | "red";
  link?: { href: string; label: string };
}) {
  const valueColor = {
    slate: "text-slate-900",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-red-700",
  };
  const badgeColor = {
    slate: "bg-slate-50",
    emerald: "bg-emerald-50",
    amber: "bg-amber-50",
    red: "bg-red-50",
  };
  return (
    <div className={`rounded-xl border border-slate-200 ${badgeColor[color]} p-5`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${valueColor[color]}`}>{value}</p>
      {link ? (
        <a href={link.href} className="mt-1 inline-block text-xs font-medium text-slate-600 underline hover:text-slate-900">
          {link.label}
        </a>
      ) : null}
    </div>
  );
}


