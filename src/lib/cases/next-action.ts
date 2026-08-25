import { isFebrk, isNfbrk, isCalling } from "./clearance-type";

export type NextActionGroup = "action_required" | "monitoring" | "completed";

export interface NextAction {
  id: string;
  group: NextActionGroup;
  label: string;
  slaAt: string | null;
  order: number;
}

const GROUP_ORDER: Record<NextActionGroup, number> = {
  action_required: 0,
  monitoring: 1,
  completed: 2,
};

export const NEXT_ACTION_LABELS: Record<string, string> = {
  call_consignee: "Call consignee",
  collect_do: "Collect DO",
  review_reply: "Review reply",
  awaiting_documents: "Awaiting documents",
  monitor_broker: "Monitor broker clearance",
  monitor_clearance: "Monitor clearance",
  awaiting_boe_filing: "Awaiting BOE filing",
  awaiting_duty_assessment: "Awaiting duty assessment",
  awaiting_ooc: "Awaiting out of charge",
  awaiting_do: "Awaiting DO",
  pending_info_gathering: "Gather pending info",
  no_action: "No action needed",
};

const NOW = Date.now();

function hoursSince(date: string | null | undefined): number {
  if (!date) return Infinity;
  return (NOW - new Date(date).getTime()) / 3600000;
}

interface CaseData {
  current_status: string;
  clearance_type: string | null;
  created_at: string;
  do_ready_at: string | null;
  do_collected_at: string | null;
  boe_filed_at: string | null;
}

export function computeNextAction(caseData: CaseData): NextAction {
  const ct = caseData.clearance_type ?? "";
  const status = caseData.current_status;

  // Completed statuses
  if (status === "closed" || status === "do_collected") {
    return {
      id: "no_action",
      group: "completed",
      label: "Completed",
      slaAt: null,
      order: GROUP_ORDER.completed,
    };
  }

  // Calling type — always action required
  if (isCalling(ct)) {
    return {
      id: "call_consignee",
      group: "action_required",
      label: "Call consignee — pending info",
      slaAt: null,
      order: GROUP_ORDER.action_required,
    };
  }

  // NFBRK-specific logic
  if (isNfbrk(ct) || !ct) {
    // do_ready + not collected → urgent DO collection
    if (status === "do_ready") {
      const h = hoursSince(caseData.do_ready_at ?? caseData.created_at);
      const sla = new Date(
        Date.parse(caseData.do_ready_at ?? caseData.created_at) + 24 * 3600000,
      ).toISOString();
      return {
        id: "collect_do",
        group: "action_required",
        label: h > 24 ? "⚠ DO overdue — collect now" : "Collect DO",
        slaAt: sla,
        order: GROUP_ORDER.action_required,
      };
    }

    // awaiting_reply — check if overdue for a call
    if (status === "awaiting_reply") {
      const h = hoursSince(caseData.created_at);
      if (h > 48) {
        return {
          id: "call_consignee",
          group: "action_required",
          label: "Call consignee — no reply in 48h",
          slaAt: new Date(
            Date.parse(caseData.created_at) + 48 * 3600000,
          ).toISOString(),
          order: GROUP_ORDER.action_required,
        };
      }
      return {
        id: "awaiting_documents",
        group: "monitoring",
        label: "Awaiting documents from consignee",
        slaAt: null,
        order: GROUP_ORDER.monitoring,
      };
    }

    if (status === "reply_received") {
      return {
        id: "review_reply",
        group: "action_required",
        label: "Review consignee reply",
        slaAt: null,
        order: GROUP_ORDER.action_required,
      };
    }

    if (status === "documents_provided") {
      return {
        id: "awaiting_boe_filing",
        group: "monitoring",
        label: "Awaiting BOE filing",
        slaAt: null,
        order: GROUP_ORDER.monitoring,
      };
    }

    // Clearance stages — monitoring, with status-specific labels
    if (status === "boe_filed" || status === "assessment_pending") {
      return {
        id: "monitor_clearance",
        group: "monitoring",
        label: status === "boe_filed" ? "BOE filed — awaiting assessment" : "Assessment pending",
        slaAt: null,
        order: GROUP_ORDER.monitoring,
      };
    }

    if (status === "duty_assessed") {
      return {
        id: "awaiting_ooc",
        group: "monitoring",
        label: "Duty assessed — awaiting out of charge",
        slaAt: null,
        order: GROUP_ORDER.monitoring,
      };
    }

    if (status === "out_of_charge") {
      return {
        id: "awaiting_do",
        group: "monitoring",
        label: "Out of charge — awaiting DO",
        slaAt: null,
        order: GROUP_ORDER.monitoring,
      };
    }
  }

  // FEBRK (Jeena / Sunimpex) — broker handles everything
  if (isFebrk(ct)) {
    if (status === "do_ready") {
      return {
        id: "awaiting_do",
        group: "monitoring",
        label: "DO ready — broker handles collection",
        slaAt: null,
        order: GROUP_ORDER.monitoring,
      };
    }
    return {
      id: "monitor_broker",
      group: "monitoring",
      label: "Broker handling clearance",
      slaAt: null,
      order: GROUP_ORDER.monitoring,
    };
  }

  // Fallback
  return {
    id: "no_action",
    group: "monitoring",
    label: NEXT_ACTION_LABELS.no_action,
    slaAt: null,
    order: GROUP_ORDER.monitoring,
  };
}

export function nextActionLabel(id: string): string {
  return NEXT_ACTION_LABELS[id] ?? id.replace(/_/g, " ");
}

export function nextActionGroup(id: string): NextActionGroup {
  if (id === "no_action") return "completed";
  if (
    id === "call_consignee" ||
    id === "collect_do" ||
    id === "review_reply" ||
    id === "pending_info_gathering"
  ) {
    return "action_required";
  }
  return "monitoring";
}
