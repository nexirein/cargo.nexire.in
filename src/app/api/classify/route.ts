import "server-only";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ClassifyResult {
  issueType: string;
  urgency: "low" | "normal" | "urgent";
  actionNeeded: "ignore" | "auto_send" | "draft_approve" | "human_review";
  confidence: number;
  humanReviewRequired: boolean;
  reason: string;
}

interface Rule {
  name: string;
  keywords: RegExp[];
  issueType: string;
  urgency: "low" | "normal" | "urgent";
  actionNeeded: "ignore" | "auto_send" | "draft_approve" | "human_review";
  confidence: number;
  humanReviewRequired: boolean;
}

const RULES: Rule[] = [
  // Auto-replies / OOO — always ignore
  {
    name: "out_of_office",
    keywords: [
      /out of office/i, /\booo\b/i, /automatic reply/i, /away from (office|desk)/i,
      /on (leave|vacation|holiday)/i, /not in the (office|work)/i, /will be back/i,
    ],
    issueType: "no_action",
    urgency: "low",
    actionNeeded: "ignore",
    confidence: 0.9,
    humanReviewRequired: false,
  },
  // Bounce / delivery failure — always ignore
  {
    name: "bounce",
    keywords: [
      /(delivery|mail|message) (failed|failure)/i, /undeliverable/i,
      /address rejected/i, /mailbox (full|unavailable)/i,
      /550 5\.1\.1/i, /554 5\.7\.1/i, /permanent (failure|error)/i,
    ],
    issueType: "no_action",
    urgency: "low",
    actionNeeded: "ignore",
    confidence: 0.95,
    humanReviewRequired: false,
  },
  // Payment confirmation — auto-close
  {
    name: "payment_received",
    keywords: [
      /payment (received|made|done|completed|confirmed)/i,
      /(amount|charges|fee) (paid|settled|cleared)/i,
      /(remitted|transferred) (the )?(amount|payment)/i,
      /proof of payment/i, /payment (attached|enclosed)/i,
      /demand draft/i, /\bdd\b.*paid/i, /do charges paid/i,
    ],
    issueType: "payment_received",
    urgency: "normal",
    actionNeeded: "auto_send",
    confidence: 0.85,
    humanReviewRequired: false,
  },
  // Invoice / PDF request — auto-send
  {
    name: "invoice_request",
    keywords: [
      /(send|email|provide|share|forward) (me )?(the )?(invoice|bill|statement)/i,
      /(need|require|want|request) (invoice|pdf|document)/i,
      /invoice (not attached|missing|not found)/i,
      /(please )?attach (the )?invoice/i, /(where is|send me) (the )?invoice/i,
      /can'?t (find|open|download) (the )?(invoice|attachment)/i,
    ],
    issueType: "pdf_invoice_request",
    urgency: "normal",
    actionNeeded: "auto_send",
    confidence: 0.8,
    humanReviewRequired: false,
  },
  // Checklist / document request — draft + approve
  {
    name: "checklist_request",
    keywords: [
      /(send|need|require) (checklist|documents|paperwork|clearance)/i,
      /customs (documents|clearance|formalities)/i,
      /(bill of lading|packing list|certificate of origin)/i,
      /(need|send) (copy|duplicate) of/i, /(required )?(document|form) (for|to)/i,
    ],
    issueType: "checklist_request",
    urgency: "normal",
    actionNeeded: "draft_approve",
    confidence: 0.7,
    humanReviewRequired: true,
  },
  // Status query — draft reply
  {
    name: "status_query",
    keywords: [
      /(where|status|location|tracking|eta|estimated) (is|of|for|my)/i,
      /(when|what time) (will|is) (it|shipment|my cargo)/i,
      /(arrival|delivery|clearance) (date|time|status|update)/i,
      /(any )?(update|news) on/i, /(has )?(it|shipment) (arrived|cleared|reached)/i,
      /\bstatus\b.{0,20}(shipment|cargo|awb|consignment)/i,
    ],
    issueType: "status_query",
    urgency: "normal",
    actionNeeded: "draft_approve",
    confidence: 0.75,
    humanReviewRequired: true,
  },
  // Reminder / follow-up needed
  {
    name: "reminder_needed",
    keywords: [
      /(gentle|kindly|friendly) (reminder|follow.up|followup)/i,
      /(any )?(update|response|feedback) (on|regarding)/i,
      /(awaiting|waiting for) (your|the) (response|reply|feedback)/i,
      /(haven'?t|not yet) (received|heard|got)/i,
      /(please )?(follow up|expedite|prioritize)/i,
    ],
    issueType: "reminder_needed",
    urgency: "normal",
    actionNeeded: "human_review",
    confidence: 0.7,
    humanReviewRequired: true,
  },
  // Acknowledgment / info-only
  {
    name: "acknowledgment",
    keywords: [
      /(thank|thanks|thx) (you )?(for|very much)/i,
      /(received|got|have) (the )?(details|info|email|update)/i,
      /(will|we'?ll) (check|review|look into|get back)/i,
      /(noted|acknowledged|understood|roger)/i,
      /(fine|ok|okay|sure|alright) (thanks|thank you)/i,
    ],
    issueType: "info_only",
    urgency: "low",
    actionNeeded: "ignore",
    confidence: 0.7,
    humanReviewRequired: false,
  },
  // Escalation / angry customer — urgent
  {
    name: "escalation",
    keywords: [
      /(escalate|escalation|complaint|formal complaint)/i,
      /(speak to|talk to|contact) (manager|supervisor|superior)/i,
      /(legal|attorney|lawyer|court|sue|lawsuit)/i,
      /(unacceptable|terrible|horrible|disgusting) (service|experience)/i,
      /\bSLA\b.{0,30}(breach|violation|miss)/i,
      /(compensation|damages|penalty|liquidated)/i,
    ],
    issueType: "escalation",
    urgency: "urgent",
    actionNeeded: "human_review",
    confidence: 0.85,
    humanReviewRequired: true,
  },
  // Special case / needs manual handling
  {
    name: "special_case",
    keywords: [
      /(special|exceptional|unique) (case|request|handling|situation)/i,
      /(overweight|oversize|dangerous|hazardous|perishable)/i,
      /(change|modify|amend) (shipment|booking|address|delivery)/i,
      /(damage|missing|short|lost|theft|pilferage)/i,
    ],
    issueType: "special_case",
    urgency: "normal",
    actionNeeded: "human_review",
    confidence: 0.75,
    humanReviewRequired: true,
  },
];

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const subject = body.subject ?? "";
  const textBody = body.textBody ?? "";
  const htmlBody = body.htmlBody ?? "";
  const from = body.from ?? "";
  const fullText = `${subject} ${textBody} ${htmlBody}`;

  // Default: unclear → human review
  let best: Rule = {
    name: "unclear",
    keywords: [],
    issueType: "unclear",
    urgency: "normal",
    actionNeeded: "human_review",
    confidence: 0,
    humanReviewRequired: true,
  };

  for (const rule of RULES) {
    let matches = 0;
    for (const pattern of rule.keywords) {
      const match = fullText.match(pattern);
      if (match) {
        matches++;
      }
    }
    if (matches > 0) {
      // More matched keywords = higher confidence (capped at rule's base)
      const boost = Math.min((matches - 1) * 0.05, 0.1);
      const confidence = Math.min(rule.confidence + boost, 0.99);
      if (confidence > best.confidence) {
        best = { ...rule, confidence };
      }
    }
  }

  // Check sender for known patterns
  const lower = fullText.toLowerCase();
  if (lower.includes("mailer-daemon") || from.includes("mailer-daemon")) {
    best = {
      name: "bounce",
      keywords: [],
      issueType: "no_action",
      urgency: "low",
      actionNeeded: "ignore",
      confidence: 0.98,
      humanReviewRequired: false,
    };
  }

  return NextResponse.json({
    issueType: best.issueType,
    urgency: best.urgency,
    actionNeeded: best.actionNeeded,
    confidence: best.confidence,
    humanReviewRequired: best.humanReviewRequired,
    reason: `Classified as "${best.name}" with ${Math.round(best.confidence * 100)}% confidence`,
  });
}
