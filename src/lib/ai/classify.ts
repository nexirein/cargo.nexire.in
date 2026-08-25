import "server-only";
import { embedText } from "@/lib/ai/embed";
import { checkSafety } from "@/lib/ai/safety";
import { getAppConfig } from "@/lib/ai/config";
import { geminiChat } from "@/lib/ai/gemini";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ClassificationInput,
  ClassificationResult,
  ClearanceType,
  Intent,
  Urgency,
  ResponseType,
  Route,
  RuleMatch,
  StageOutputs,
} from "@/lib/ai/types";

const CLASSIFIER_VERSION = "v1.0.0";

interface Rule {
  name: string;
  keywords: string[];
  clearanceType: ClearanceType;
  intent: Intent;
  urgency: Urgency;
  responseType: ResponseType;
  confidence: number;
  humanReviewRequired: boolean;
}

const RULES: Rule[] = [
  { name: "nfbrk_docs_submission", keywords: ["nfbrk", "documents", "submitted", "clearance"], clearanceType: "nfbrk", intent: "update", urgency: "normal", responseType: "acknowledge", confidence: 0.85, humanReviewRequired: false },
  { name: "febrk_broker_question", keywords: ["febrk", "broker", "sunimpex", "jeena"], clearanceType: "febrk", intent: "inquiry", urgency: "normal", responseType: "provide_info", confidence: 0.85, humanReviewRequired: false },
  { name: "calling_request", keywords: ["calling", "call", "callback", "phone", "contact"], clearanceType: "calling", intent: "inquiry", urgency: "normal", responseType: "acknowledge", confidence: 0.8, humanReviewRequired: false },
  { name: "hold_request", keywords: ["hold", "on hold", "keep", "wait"], clearanceType: "hold", intent: "update", urgency: "low", responseType: "acknowledge", confidence: 0.8, humanReviewRequired: false },
  { name: "escalation", keywords: ["escalate", "escalation", "supervisor", "manager", "complaint"], clearanceType: "nfbrk", intent: "escalation", urgency: "high", responseType: "escalate", confidence: 0.9, humanReviewRequired: true },
  { name: "urgent_time_sensitive", keywords: ["urgent", "asap", "immediately", "emergency", "deadline"], clearanceType: "nfbrk", intent: "inquiry", urgency: "critical", responseType: "request_docs", confidence: 0.85, humanReviewRequired: true },
  { name: "docs_request", keywords: ["document", "docs", "invoice", "packing list", "boe", "bill of entry"], clearanceType: "nfbrk", intent: "docs_request", urgency: "normal", responseType: "request_docs", confidence: 0.8, humanReviewRequired: false },
  { name: "confirmation_receipt", keywords: ["confirm", "confirmed", "received", "got it", "thank you", "thanks"], clearanceType: "nfbrk", intent: "confirmation", urgency: "low", responseType: "acknowledge", confidence: 0.85, humanReviewRequired: false },
  { name: "do_query", keywords: ["delivery order", "do", "do collection", "do charges", "deldo"], clearanceType: "nfbrk", intent: "inquiry", urgency: "normal", responseType: "provide_info", confidence: 0.8, humanReviewRequired: false },
  { name: "igm_query", keywords: ["igm", "bill of lading", "manifest", "master awb", "mawb"], clearanceType: "nfbrk", intent: "inquiry", urgency: "normal", responseType: "provide_info", confidence: 0.8, humanReviewRequired: false },
  { name: "shipment_info_request", keywords: ["shipment info", "more info", "more information", "more details", "details about", "details of", "my shipment", "shipment details", "freight charges", "freight", "status", "tracking", "where is", "arrival status", "about this shipment", "update on"], clearanceType: "nfbrk", intent: "inquiry", urgency: "normal", responseType: "provide_info", confidence: 0.82, humanReviewRequired: false },
  { name: "penalty_question", keywords: ["penalty", "late fee", "fine", "5000", "10000", "notification 34"], clearanceType: "nfbrk", intent: "inquiry", urgency: "high", responseType: "provide_info", confidence: 0.85, humanReviewRequired: false },
  { name: "out_of_office", keywords: ["out of office", "ooo", "on leave", "vacation", "not in office"], clearanceType: "nfbrk", intent: "other", urgency: "low", responseType: "no_action", confidence: 0.95, humanReviewRequired: false },
  { name: "auto_reply_bounce", keywords: ["mail delivery failed", "undelivered", "bounce", "delivery status notification", "failure notice"], clearanceType: "nfbrk", intent: "other", urgency: "low", responseType: "no_action", confidence: 0.95, humanReviewRequired: false },
];

function ruleFastPath(subject: string, body: string): { matches: RuleMatch[]; classification: Partial<ClassificationResult> } {
  const combinedText = (subject + " " + body).toLowerCase();
  const matches: RuleMatch[] = [];

  for (const rule of RULES) {
    const allMatch = rule.keywords.some((kw) => combinedText.includes(kw.toLowerCase()));
    if (allMatch) {
      matches.push({ name: rule.name, confidence: rule.confidence });
    }
  }

  if (matches.length === 0) {
    return { matches, classification: {} };
  }

  const bestMatch = matches.reduce((a, b) => (a.confidence > b.confidence ? a : b));
  const bestRule = RULES.find((r) => r.name === bestMatch.name)!;

  return {
    matches,
    classification: {
      clearanceType: bestRule.clearanceType,
      intent: bestRule.intent,
      urgency: bestRule.urgency,
      responseType: bestRule.responseType,
      confidence: bestMatch.confidence,
      humanReviewRequired: bestRule.humanReviewRequired,
    },
  };
}

async function mlClassifier(subject: string, body: string): Promise<{
  clearanceType?: string;
  intent?: string;
  confidence: number;
  probabilities?: Record<string, number>;
} | null> {
  try {
    const supabase = createAdminClient();
    const combinedText = subject + " " + body;
    const embedding = await embedText(combinedText);

    const { data, error } = await supabase.rpc("match_similar_emails", {
      query_embedding: embedding,
      match_threshold: 0.75,
      match_count: 3,
      filter_clearance_type: null,
      filter_intent: null,
    });

    if (error || !data || data.length === 0) {
      return null;
    }

    const clearanceCounts: Record<string, number> = {};
    const intentCounts: Record<string, number> = {};
    for (const row of data) {
      if (row.clearance_type) clearanceCounts[row.clearance_type] = (clearanceCounts[row.clearance_type] ?? 0) + 1;
      if (row.intent) intentCounts[row.intent] = (intentCounts[row.intent] ?? 0) + 1;
    }

    const bestClearance = Object.entries(clearanceCounts).sort((a, b) => b[1] - a[1])[0];
    const bestIntent = Object.entries(intentCounts).sort((a, b) => b[1] - a[1])[0];

    if (!bestClearance) return null;

    return {
      clearanceType: bestClearance[0],
      intent: bestIntent?.[0],
      confidence: bestClearance[1] / data.length,
      probabilities: clearanceCounts,
    };
  } catch (err) {
    console.warn("[ai/classify] ML classifier failed:", err);
    return null;
  }
}

async function llmVerifier(
  subject: string,
  body: string,
  sender: string,
  ruleResult: Partial<ClassificationResult>,
  mlResult: { clearanceType?: string; intent?: string; confidence: number } | null,
): Promise<{
  clearanceType?: string;
  intent?: string;
  urgency?: string;
  responseType?: string;
  reasoning?: string;
  entities?: Record<string, string>;
  flags?: string[];
} | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const content = await geminiChat({
      system: "You are a FedEx cargo pre-alert operations classifier. Return ONLY valid JSON, no markdown.",
      prompt: `Analyze this email and return structured JSON.

Email Subject: ${subject}
Email Body: ${body}
Sender: ${sender}

Return JSON with these fields:
- clearance_type: "nfbrk" | "febrk" | "febrk-sunimpex" | "febrk-jeena" | "calling" | "hold"
- intent: "inquiry" | "update" | "escalation" | "confirmation" | "docs_request" | "other"
- urgency: "low" | "normal" | "high" | "critical"
- response_type: "acknowledge" | "provide_info" | "request_docs" | "escalate" | "no_action"
- reasoning: brief explanation
- flags: array of any concerns (e.g. "urgent", "vip", "legal", "missing_info")

Additional context from rule system: ${JSON.stringify(ruleResult)}
Additional context from similar emails: ${JSON.stringify(mlResult)}`,
      temperature: 0.1,
      jsonMode: true,
    });
    if (!content) return null;

    const parsed = JSON.parse(content);
    return {
      clearanceType: parsed.clearance_type,
      intent: parsed.intent,
      urgency: parsed.urgency,
      responseType: parsed.response_type,
      reasoning: parsed.reasoning,
      flags: parsed.flags,
    };
  } catch (err) {
    console.warn("[ai/classify] LLM verifier failed:", err);
    return null;
  }
}

function ensembleFusion(
  ruleResult: Partial<ClassificationResult>,
  mlResult: { clearanceType?: string; intent?: string; confidence: number } | null,
  llmResult: {
    clearanceType?: string;
    intent?: string;
    urgency?: string;
    responseType?: string;
    reasoning?: string;
  } | null,
): {
  clearanceType: ClearanceType;
  intent: Intent;
  urgency: Urgency;
  responseType: ResponseType;
  confidence: number;
  method: string;
} {
  const availableSources = [];

  if (llmResult?.clearanceType) availableSources.push({ source: "llm", confidence: 0.95 });
  if (mlResult?.clearanceType) availableSources.push({ source: "ml", confidence: 0.85 });
  if (ruleResult.clearanceType) availableSources.push({ source: "rule", confidence: ruleResult.confidence ?? 0.7 });

  const bestSource = availableSources.sort((a, b) => b.confidence - a.confidence)[0];

  if (!bestSource) {
    return {
      clearanceType: "nfbrk",
      intent: "other",
      urgency: "normal",
      responseType: "provide_info",
      confidence: 0.5,
      method: "default",
    };
  }

  const clearanceType: ClearanceType =
    bestSource.source === "llm"
      ? (llmResult!.clearanceType as ClearanceType)
      : bestSource.source === "ml"
        ? (mlResult!.clearanceType as ClearanceType)
        : (ruleResult.clearanceType as ClearanceType);

  const intent: Intent = (
    bestSource.source === "llm"
      ? llmResult!.intent
      : ruleResult.intent ?? "other"
  ) as Intent;

  const urgency: Urgency = (
    bestSource.source === "llm"
      ? llmResult!.urgency
      : ruleResult.urgency ?? "normal"
  ) as Urgency;

  const responseType: ResponseType = (
    bestSource.source === "llm"
      ? llmResult!.responseType
      : ruleResult.responseType ?? "provide_info"
  ) as ResponseType;

  let confidence = bestSource.confidence;
  if (llmResult && mlResult && ruleResult.clearanceType) {
    const allMatch =
      llmResult.clearanceType === mlResult.clearanceType &&
      mlResult.clearanceType === ruleResult.clearanceType;
    if (allMatch) {
      confidence = Math.min(confidence + 0.08, 0.99);
    }
  }

  return {
    clearanceType,
    intent,
    urgency,
    responseType,
    confidence: Math.round(confidence * 100) / 100,
    method: bestSource.source,
  };
}

export async function classify(input: ClassificationInput): Promise<ClassificationResult> {
  const startTime = Date.now();
  const config = await getAppConfig();
  const combinedText = input.subject + " " + input.body;

  const safetyCheck = await checkSafety(input);
  if (!safetyCheck.passed) {
    return {
      clearanceType: "nfbrk",
      intent: "other",
      urgency: "normal",
      responseType: "provide_info",
      route: "human_review",
      confidence: 0,
      humanReviewRequired: true,
      stageOutputs: { rule: { matches: [] }, ml: null, llm: null },
      explanation: safetyCheck.reason ?? "Safety gate triggered",
      latencyMs: Date.now() - startTime,
      classifierVersion: CLASSIFIER_VERSION,
    };
  }

  const ruleResult = ruleFastPath(input.subject, input.body);

  // Auto-ignore: out-of-office auto-replies and mail bounces are machine
  // noise, not customer queries. A confident, non-urgent no_action rule match
  // means the AI handles it silently — no draft, no human, no reply sent.
  const autoIgnoreMatch =
    ruleResult.classification.responseType === "no_action" &&
    (ruleResult.classification.confidence ?? 0) >= 0.9 &&
    ruleResult.classification.urgency !== "high" &&
    ruleResult.classification.urgency !== "critical";

  // Fast path: a confident routine rule match (information request or
  // acknowledgement at low/normal urgency, not flagged for human review) can
  // skip both the slow vector lookup and the LLM verifier entirely — the rule
  // alone already clears the routine auto-send threshold. Cuts classify
  // latency from ~10-18s to ~1-2s for the most common customer queries.
  const routineRuleMatch =
    (ruleResult.classification.confidence ?? 0) >= config.autoSendRoutineMinConfidence &&
    (ruleResult.classification.responseType === "provide_info" ||
      ruleResult.classification.responseType === "acknowledge") &&
    (ruleResult.classification.urgency === "low" ||
      ruleResult.classification.urgency === "normal") &&
    !ruleResult.classification.humanReviewRequired;

  const mlResult = routineRuleMatch || autoIgnoreMatch
    ? null
    : await mlClassifier(input.subject, input.body);

  const llmResult = routineRuleMatch || autoIgnoreMatch
    ? null
    : await llmVerifier(input.subject, input.body, input.sender, ruleResult.classification, mlResult);

  const ensemble = ensembleFusion(ruleResult.classification, mlResult, llmResult);

  // Recalibrate inflated urgency. A routine information/confirmation
  // request that the rule system rated low/normal should not be blocked from
  // auto-send just because the LLM verifier flagged "high". Urgency words that
  // commonly appear in the quoted pre-alert template (deadline, penalty, asap)
  // are intentionally ignored — a routine info reply quoting the template is
  // still a routine info request. Only genuine escalation/complaint/legal or
  // true critical signals block auto-send.
  const ruleUrgency = ruleResult.classification.urgency;
  const hasBlockingSignal =
    /(escalat|complaint|supervisor|manager|right away|emergency|critical)/i.test(
      combinedText,
    ) ||
    config.legalKeywords.some((kw) => combinedText.toLowerCase().includes(kw.toLowerCase()));
  const isRoutineRequest =
    (ensemble.responseType === "provide_info" || ensemble.responseType === "acknowledge") &&
    (ensemble.intent === "inquiry" ||
      ensemble.intent === "confirmation" ||
      ensemble.intent === "update" ||
      ensemble.intent === "docs_request");

  // Aggressive urgency downgrade: if urgency is "high" but there are NO
  // genuine escalation signals in the email text, force it to "normal".
  // This prevents the LLM from blocking routine auto-replies with inflated
  // urgency on vague or unclear queries.
  if (
    ensemble.urgency === "high" &&
    !hasBlockingSignal
  ) {
    ensemble.urgency = "normal";
  }

  const isVip = config.vipSenders.some((v) => input.sender.toLowerCase().includes(v.toLowerCase()));
  const hasLegalKeywords = config.legalKeywords.some((kw) => combinedText.toLowerCase().includes(kw.toLowerCase()));

  const matchesPattern = config.autoSendPatterns.length === 0 ||
    config.autoSendPatterns.some((p) => {
      if (p.clearance_type && p.clearance_type !== ensemble.clearanceType) return false;
      if (p.intent && p.intent !== ensemble.intent) return false;
      return true;
    });

  let route: Route;
  let humanReviewRequired = true;

  // Routine requests — generic shipment info, IGM/DO/charges queries,
  // confirmations, ack updates — are safe to auto-answer (grounded in real
  // shipment facts) at a lower confidence than the strict auto-send.
  const isRoutine =
    (ensemble.responseType === "provide_info" || ensemble.responseType === "acknowledge") &&
    (ensemble.intent === "inquiry" || ensemble.intent === "confirmation" ||
      ensemble.intent === "update" || ensemble.intent === "docs_request") &&
    (ensemble.urgency === "low" || ensemble.urgency === "normal");

  const routineAutoSendEligible =
    config.autoSendRoutineEnabled &&
    isRoutine &&
    ensemble.confidence >= config.autoSendRoutineMinConfidence;

  const strictAutoSendEligible =
    config.autoSendEnabled &&
    ensemble.confidence >= 0.97 &&
    matchesPattern;

  const autoSendEligible =
    ensemble.urgency !== "high" &&
    ensemble.urgency !== "critical" &&
    !isVip &&
    !hasLegalKeywords &&
    (routineAutoSendEligible || strictAutoSendEligible);

  if (autoIgnoreMatch) {
    route = "ignore";
    humanReviewRequired = false;
  } else if (autoSendEligible) {
    route = "ai_auto_send";
    humanReviewRequired = false;
  } else if (ensemble.confidence >= config.draftHoldMinThreshold) {
    route = "ai_draft_hold";
    humanReviewRequired = true;
  } else {
    route = "human_review";
    humanReviewRequired = true;
  }

  await logClassification(input, {
    ...ensemble,
    route,
    humanReviewRequired,
    ruleMatches: ruleResult.matches,
    mlPrediction: mlResult,
    llmOutput: llmResult,
    latencyMs: Date.now() - startTime,
  });

  return {
    clearanceType: ensemble.clearanceType,
    intent: ensemble.intent,
    urgency: ensemble.urgency,
    responseType: ensemble.responseType,
    route,
    confidence: ensemble.confidence,
    humanReviewRequired,
    stageOutputs: {
      rule: { matches: ruleResult.matches },
      ml: mlResult,
      llm: llmResult,
    },
    explanation: `Ensemble (${ensemble.method}): ${ensemble.clearanceType}/${ensemble.intent}/${ensemble.urgency}, confidence=${ensemble.confidence}, route=${route}`,
    latencyMs: Date.now() - startTime,
    classifierVersion: CLASSIFIER_VERSION,
  };
}

async function logClassification(
  input: ClassificationInput,
  details: {
    clearanceType: ClearanceType;
    intent: Intent;
    urgency: Urgency;
    responseType: ResponseType;
    route: Route;
    confidence: number;
    humanReviewRequired: boolean;
    ruleMatches: RuleMatch[];
    mlPrediction: object | null;
    llmOutput: object | null;
    latencyMs: number;
  },
): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("ai_classifications").insert({
      case_id: input.caseId ?? null,
      email_event_id: input.emailEventId ?? null,
      classifier_version: CLASSIFIER_VERSION,
      model_used: "ensemble-v1",
      clearance_type: details.clearanceType,
      intent: details.intent,
      urgency: details.urgency,
      response_type: details.responseType,
      confidence: details.confidence,
      route: details.route,
      human_review_required: details.humanReviewRequired,
      rule_matches: details.ruleMatches,
      ml_prediction: details.mlPrediction,
      llm_raw_output: details.llmOutput,
      ensemble_details: { method: "ensemble-v1", sources: ["rule", "ml", "llm"] },
      latency_ms: details.latencyMs,
      explanation: `Ensemble: ${details.clearanceType}/${details.intent}, conf=${details.confidence}, route=${details.route}`,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[ai/classify] Failed to log classification:", err);
  }
}
