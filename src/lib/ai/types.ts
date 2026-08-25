export type ClearanceType =
  | 'nfbrk'
  | 'febrk'
  | 'febrk-sunimpex'
  | 'febrk-jeena'
  | 'calling'
  | 'hold';

export type Intent =
  | 'inquiry'
  | 'update'
  | 'escalation'
  | 'confirmation'
  | 'docs_request'
  | 'other';

export type Urgency = 'low' | 'normal' | 'high' | 'critical';

export type ResponseType =
  | 'acknowledge'
  | 'provide_info'
  | 'request_docs'
  | 'escalate'
  | 'no_action';

export type Route = 'ignore' | 'ai_auto_send' | 'ai_draft_hold' | 'human_review';

export type DraftStatus = 'pending' | 'approved' | 'edited' | 'rejected' | 'sent';

export type FollowUpStatus =
  | 'scheduled'
  | 'draft_ready'
  | 'approved'
  | 'edited'
  | 'sent'
  | 'cancelled'
  | 'completed';

export type TriggerRule =
  | 'nfbrk_24h'
  | 'febrk_48h'
  | 'calling_4h'
  | 'hold_daily'
  | 'inactive_7d'
  | 'escalation_2h';

export type TriggerType =
  | 'inbound_reply'
  | 'followup_scheduled'
  | 'batch_review'
  | 'call_summary';

export type DraftFlag =
  | 'missing_attachment_reference'
  | 'needs_dates_confirmation'
  | 'low_confidence_draft'
  | 'missing_variables'
  | 'legal_sensitivity'
  | 'vip_customer';

export interface RuleMatch {
  name: string;
  confidence: number;
}

export interface StageOutputs {
  rule: { matches: RuleMatch[] };
  ml: { clearanceType?: string; intent?: string; confidence: number; probabilities?: Record<string, number> } | null;
  llm: {
    clearanceType?: string;
    intent?: string;
    urgency?: string;
    responseType?: string;
    reasoning?: string;
    entities?: Record<string, string>;
    flags?: string[];
  } | null;
}

export interface ClassificationInput {
  subject: string;
  body: string;
  sender: string;
  threadHistory?: string[];
  awb?: string;
  emailEventId?: string;
  caseId?: string;
}

export interface ClassificationResult {
  clearanceType: ClearanceType;
  intent: Intent;
  urgency: Urgency;
  responseType: ResponseType;
  route: Route;
  confidence: number;
  humanReviewRequired: boolean;
  stageOutputs: StageOutputs;
  explanation: string;
  latencyMs: number;
  classifierVersion: string;
}

export interface DraftInput {
  subject: string;
  body: string;
  sender: string;
  awb?: string;
  consigneeName?: string;
  broker?: string;
  doNumber?: string;
  clearanceType: ClearanceType;
  intent: Intent;
  urgency: Urgency;
  shipmentContext?: ShipmentInfoContext;
}

export interface DraftResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  confidence: number;
  flags: DraftFlag[];
  variablesUsed: string[];
  templateId?: string;
}

export interface FollowUpInput {
  caseId: string;
  awb: string;
  clearanceType: ClearanceType;
  triggerRule: TriggerRule;
  attemptNumber: number;
  maxAttempts: number;
}

export interface FollowUpResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  scheduledAt: Date;
  attemptNumber: number;
  confidence: number;
}

export interface SafetyCheckResult {
  passed: boolean;
  gate?: string;
  reason?: string;
}

export interface RAGContext {
  similarEmails: Array<{
    id: string;
    subject: string;
    bodyClean: string;
    actualReply: string;
    similarity: number;
  }>;
  bestTemplate: {
    id: string;
    subjectTemplate: string;
    bodyTemplate: string;
    variables: string[];
  } | null;
  currentCase: {
    awb?: string;
    consigneeName?: string;
    broker?: string;
    doNumber?: string;
    clearanceType?: ClearanceType;
    intent?: Intent;
    urgency?: Urgency;
  };
}

/**
 * Real shipment facts pulled from awb_cases + batch_items for the AWB, used to
 * ground AI auto-replies for generic "tell me about my shipment" requests so
 * the AI never invents IGM/MAWB/flight/charge details.
 */
export interface ShipmentInfoContext {
  awb?: string;
  consigneeName?: string | null;
  consigneeEmail?: string | null;
  clearanceType?: ClearanceType;
  fedexBroker?: string | null;
  currentStatus?: string | null;
  mawb?: string | null;
  igmNumber?: string | null;
  igmDate?: string | null;
  flightNumber?: string | null;
  originPort?: string | null;
  destPort?: string | null;
  doNumber?: string | null;
  doReadyAt?: string | null;
  doPaymentStatus?: string | null;
  utrNo?: string | null;
  freight?: string | null;
  currency?: string | null;
  pieces?: string | null;
  weight?: string | null;
  value?: string | null;
  iec?: string | null;
  pinCode?: string | null;
  loc?: string | null;
  shipDate?: string | null;
  dutyBillAccount?: string | null;
  account?: string | null;
  standardRemarks?: string | null;
  mode?: string | null;
}

export interface AutoSendPattern {
  clearance_type?: string;
  intent?: string;
  min_confidence?: number;
}

export interface AppConfig {
  aiEnabled: boolean;
  autoSendEnabled: boolean;
  followupEnabled: boolean;
  callAiEnabled: boolean;
  classifierVersion: string;
  draftHoldMinThreshold: number;
  vipDomains: string[];
  vipSenders: string[];
  legalKeywords: string[];
  autoSendPatterns: AutoSendPattern[];
  // Generic/routine info requests ("need more info about this shipment",
  // IGM/DO/charges queries, confirmations) auto-send at a lower confidence
  // than the strict 0.97 auto-send, grounded in real shipment facts.
  autoSendRoutineEnabled: boolean;
  autoSendRoutineMinConfidence: number;
}
