"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  FileText, ClipboardList, ClipboardCheck, Truck, FileCheck, Phone, PauseCircle,
} from "lucide-react";
import { CLEARANCE_DISPLAY, isFebrk, isNfbrk, isCalling, isHold } from "@/lib/cases/clearance-type";

const CLEARANCE_STEPS = [
  { key: "igm", label: "IGM Provided", icon: ClipboardList, checkField: "igm_number" as const },
  { key: "boe", label: "BOE Filed", icon: FileText, checkField: "boe_filed_at" as const },
  { key: "clearance", label: "Out of Charge", icon: ClipboardCheck, checkField: "out_of_charge_at" as const },
  { key: "do_ready", label: "DO Ready", icon: Truck, checkField: "do_ready_at" as const },
  { key: "do_collected", label: "DO Collected", icon: FileCheck, checkField: "do_collected_at" as const },
];

interface Props {
  caseData: Record<string, unknown>;
  caseId: string;
  currentUserId?: string;
  onAction?: () => void;
}

export function ClearanceTracker({ caseData, caseId, currentUserId, onAction }: Props) {
  const router = useRouter();

  const status = caseData.current_status as string;
  const createdAt = caseData.created_at as string;
  const clearanceType = (caseData.clearance_type as string) ?? "";
  const boeFiledAt = caseData.boe_filed_at as string | null;
  const outOfChargeAt = caseData.out_of_charge_at as string | null;
  const doReadyAt = caseData.do_ready_at as string | null;
  const doCollectedAt = caseData.do_collected_at as string | null;
  const igmNumber = caseData.igm_number as string | null;
  const boeNumber = caseData.boe_number as string | null;
  const dutyAmount = caseData.duty_amount as number | null;
  const ownerUserId = caseData.owner_user_id as string | null;
  const ownershipStatus = caseData.ownership_status as string;

  const isOwner = ownerUserId === currentUserId;
  const canAct = isOwner || ownershipStatus === "unassigned";

  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const hoursSinceCreation = (now - created) / 3600000;

  // --- BOE Late Penalty (NFBRK & Calling only; FEBRK broker handles) ---
  const showBoePenalty = isNfbrk(clearanceType) || isCalling(clearanceType) || !clearanceType;
  const isBoeLate = showBoePenalty && !boeFiledAt && hoursSinceCreation > 24;
  const boeLateDays = Math.floor((hoursSinceCreation - 24) / 24) + 1;

  // --- DO Overdue Penalty (only relevant for NFBRK where consignee handles DO) ---
  const showDoPenalty = (isNfbrk(clearanceType) || !clearanceType) && status !== "closed" && status !== "do_collected";
  const doReadyTime = doReadyAt ? new Date(doReadyAt).getTime() : null;
  const hoursSinceDoReady = doReadyTime ? (now - doReadyTime) / 3600000 : 0;
  const isDoOverdue = showDoPenalty && !!doReadyTime && !doCollectedAt && hoursSinceDoReady > 24;
  const doOverdueDays = Math.floor((hoursSinceDoReady - 24) / 24) + 1;

  // --- Stuck Clearance ---
  const boeTime = boeFiledAt ? new Date(boeFiledAt).getTime() : null;
  const hoursSinceBoe = boeTime ? (now - boeTime) / 3600000 : 0;
  const isClearanceStuck = !!boeTime && !outOfChargeAt && hoursSinceBoe > 72;

  const currentVersion = (caseData.version as number) ?? 1;
  const stepsDone = CLEARANCE_STEPS.filter((s) => {
    if (s.key === "do_collected") return !!doCollectedAt || status === "closed";
    return !!caseData[s.checkField];
  }).length;

  async function advanceStatus(newStatus: string) {
    try {
      const res = await fetch(`/api/cases/${caseId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: currentVersion, currentStatus: newStatus }),
      });
      if (res.ok) {
        toast.success(`Status updated to ${newStatus.replace(/_/g, " ")}.`);
        if (onAction) onAction();
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to update status.");
      }
    } catch {
      toast.error("Network error.");
    }
  }

  // Type-specific header message
  const typeConfig = clearanceType ? CLEARANCE_DISPLAY[clearanceType] : null;
  const trackerTitle = isFebrk(clearanceType)
    ? "Broker Clearance (monitoring)"
    : isNfbrk(clearanceType)
    ? "Clearance Progress — DO collection by consignee"
    : isCalling(clearanceType)
    ? "Call Follow-up"
    : isHold(clearanceType)
    ? "On Hold"
    : "Clearance Progress";

  // Calling banner
  const showCallingBanner = isCalling(clearanceType);

  // Hold banner
  const showHoldBanner = isHold(clearanceType);

  return (
    <div className="space-y-4">
      {/* Type badge header */}
      {typeConfig ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full ${typeConfig.bg} ${typeConfig.text} px-2.5 py-1 text-xs font-medium`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${typeConfig.dot}`} />
              {typeConfig.label}
            </span>
            <span className="text-xs text-muted-foreground">{trackerTitle}</span>
          </div>
        </div>
      ) : null}

      {/* Calling banner */}
      {showCallingBanner ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-1">
            <Phone className="h-3.5 w-3.5" />
            Manual Call Required
          </h4>
          <p className="text-xs text-amber-700">
            This is a Calling-type shipment. Follow up with the consignee by phone
            rather than email. Track DO collection status below.
          </p>
        </div>
      ) : null}

      {/* Hold banner */}
      {showHoldBanner ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
            <PauseCircle className="h-3.5 w-3.5" />
            On Hold
          </h4>
          <p className="text-xs text-slate-500">
            This shipment is on hold. Clearance tracking is paused.
          </p>
        </div>
      ) : null}

      {/* Clearance Progress — skip for hold */}
      {!isHold(clearanceType) ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {isFebrk(clearanceType) ? "Broker Clearance Steps" : "Clearance Steps"}
          </h4>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${(stepsDone / CLEARANCE_STEPS.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {stepsDone}/{CLEARANCE_STEPS.length}
            </span>
          </div>
          <ol className="space-y-2">
            {CLEARANCE_STEPS.map((step) => {
              let done = false;
              if (step.key === "do_collected") {
                done = !!doCollectedAt || status === "closed";
              } else {
                done = !!caseData[step.checkField];
              }
              const Icon = step.icon;
              return (
                <li key={step.key} className={`flex items-center gap-2 text-xs ${done ? "text-emerald-700" : "text-muted-foreground"}`}>
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${done ? "text-emerald-500" : "text-muted-foreground/50"}`} />
                  <span className={done ? "font-medium" : ""}>{step.label}</span>
                  {done ? <span className="ml-auto text-emerald-500">&check;</span> : null}
                  {/* NFBRK emphasis on DO collection */}
                  {isNfbrk(clearanceType) && step.key === "do_collected" && !done ? (
                    <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">Consignee action</span>
                  ) : null}
                  {/* FEBRK — broker handles clearance */}
                  {isFebrk(clearanceType) && (step.key === "clearance" || step.key === "boe") && !done ? (
                    <span className="ml-2 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">Broker</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {/* BOE Late Penalty Warning — only for NFBRK/Calling/unknown */}
      {showBoePenalty && isBoeLate && status !== "boe_filed" && status !== "closed" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-red-800 mb-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            BOE Filing Overdue
          </h4>
          <p className="text-sm font-medium text-red-800">
            ₹{boeLateDays * 5000} – ₹{boeLateDays * 10000} penalty accrued
          </p>
          <p className="text-xs text-red-600 mt-0.5">
            {boeLateDays} day{boeLateDays > 1 ? "s" : ""} late &middot; ₹5,000/day (duty &le; ₹10L) or ₹10,000/day (duty &gt; ₹10L)
          </p>
          <p className="text-xs text-red-600 mt-1">
            Filed within: {new Date(createdAt).toLocaleDateString()} &rarr; {hoursSinceCreation < 48 ? "Due today" : `${Math.floor(hoursSinceCreation / 24)} days overdue`}
          </p>
        </div>
      ) : null}

      {/* Clearance Stuck Warning */}
      {isClearanceStuck ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            Clearance Stuck
          </h4>
          <p className="text-sm text-amber-800">
            BOE filed {Math.floor(hoursSinceBoe / 24)} day{Math.floor(hoursSinceBoe / 24) > 1 ? "s" : ""} ago, not yet assessed
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            Expected clearance: within 72 hours of BOE filing
          </p>
        </div>
      ) : null}

      {/* DO Overdue Penalty — only for NFBRK */}
      {isDoOverdue ? (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-orange-800 mb-1">
            <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
            DO Collection Overdue
          </h4>
          <p className="text-sm font-medium text-orange-800">
            ₹{doOverdueDays * 1000} + GST penalty accrued
          </p>
          <p className="text-xs text-orange-600 mt-0.5">
            {doOverdueDays} day{doOverdueDays > 1 ? "s" : ""} overdue &middot; ₹1,000/day + GST
          </p>
          <p className="text-xs text-orange-600 mt-1">
            DO ready since: {doReadyAt ? new Date(doReadyAt).toLocaleDateString() : "—"}
          </p>
        </div>
      ) : null}

      {/* Status Advance Buttons */}
      {canAct && status !== "closed" && status !== "do_collected" && !isHold(clearanceType) ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Advance Status
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {["awaiting_reply", "reply_received", "documents_provided"].includes(status) ? (
              <button type="button" onClick={() => advanceStatus("boe_filed")}
                className="rounded border border-blue-300 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50">
                Mark BOE Filed
              </button>
            ) : null}
            {["boe_filed"].includes(status) ? (
              <button type="button" onClick={() => advanceStatus("assessment_pending")}
                className="rounded border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50">
                Assessment Pending
              </button>
            ) : null}
            {["assessment_pending"].includes(status) ? (
              <button type="button" onClick={() => advanceStatus("duty_assessed")}
                className="rounded border border-violet-300 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50">
                Duty Assessed
              </button>
            ) : null}
            {["duty_assessed"].includes(status) ? (
              <button type="button" onClick={() => advanceStatus("out_of_charge")}
                className="rounded border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                Out of Charge
              </button>
            ) : null}
            {["out_of_charge"].includes(status) ? (
              <button type="button" onClick={() => advanceStatus("do_ready")}
                className="rounded border border-teal-300 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50">
                Mark DO Ready
              </button>
            ) : null}
            {status === "escalated" ? (
              <button type="button" onClick={() => advanceStatus("closed")}
                className="rounded border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                Mark Closed
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* IGM/BOE Reference Numbers */}
      {(igmNumber || boeNumber || dutyAmount) ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Clearance References
          </h4>
          <dl className="space-y-2 text-xs">
            {igmNumber ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">IGM Number</dt>
                <dd className="font-mono font-medium text-foreground">{igmNumber}</dd>
              </div>
            ) : null}
            {boeNumber ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">BOE Number</dt>
                <dd className="font-mono font-medium text-foreground">{boeNumber}</dd>
              </div>
            ) : null}
            {dutyAmount ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Duty Amount</dt>
                <dd className="font-medium text-foreground">₹{dutyAmount.toLocaleString("en-IN")}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
