import "server-only";
import { getAppConfig } from "@/lib/ai/config";
import type { ClassificationInput, SafetyCheckResult, Urgency } from "@/lib/ai/types";

export async function checkSafety(input: ClassificationInput): Promise<SafetyCheckResult> {
  const config = await getAppConfig();

  if (!config.aiEnabled) {
    return { passed: false, gate: "SG-08", reason: "AI system is disabled via kill-switch" };
  }

  const vipCheck = checkVip(input.sender, config.vipDomains, config.vipSenders);
  if (!vipCheck.passed) return vipCheck;

  const legalCheck = checkLegalKeywords(input.subject + " " + input.body, config.legalKeywords);
  if (!legalCheck.passed) return legalCheck;

  return { passed: true };
}

export function checkVip(sender: string, vipDomains: string[], vipSenders: string[]): SafetyCheckResult {
  const senderLower = sender.toLowerCase();

  if (vipSenders.some((vip) => senderLower.includes(vip.toLowerCase()))) {
    return { passed: false, gate: "SG-03", reason: "VIP sender — must go to human review" };
  }

  const senderDomain = senderLower.split("@").pop() ?? "";
  if (vipDomains.some((domain) => senderDomain === domain.toLowerCase())) {
    return { passed: false, gate: "SG-03", reason: "VIP domain — must go to human review" };
  }

  return { passed: true };
}

export function checkLegalKeywords(text: string, keywords: string[]): SafetyCheckResult {
  const textLower = text.toLowerCase();
  for (const keyword of keywords) {
    if (textLower.includes(keyword.toLowerCase())) {
      return {
        passed: false,
        gate: "SG-02",
        reason: `Legal/compliance keyword detected: "${keyword}"`,
      };
    }
  }
  return { passed: true };
}

export function checkUrgency(urgency: Urgency): SafetyCheckResult {
  if (urgency === "high" || urgency === "critical") {
    return {
      passed: false,
      gate: "SG-01",
      reason: `Urgent email (${urgency}) — must go to human review`,
    };
  }
  return { passed: true };
}

export function checkAutoSendSafety(
  confidence: number,
  urgency: Urgency,
  isVip: boolean,
  hasLegalKeywords: boolean,
): SafetyCheckResult {
  if (hasLegalKeywords) {
    return { passed: false, gate: "SG-02", reason: "Legal keywords detected — auto-send blocked" };
  }

  if (isVip) {
    return { passed: false, gate: "SG-03", reason: "VIP sender — auto-send blocked" };
  }

  if (urgency === "high" || urgency === "critical") {
    return { passed: false, gate: "SG-01", reason: "Urgent email — auto-send blocked" };
  }

  if (confidence < 0.97) {
    return { passed: false, gate: "SG-06", reason: `Confidence ${confidence} below auto-send threshold (0.97)` };
  }

  return { passed: true };
}

export function checkDraftApproval(status: string): SafetyCheckResult {
  if (status !== "approved") {
    return { passed: false, gate: "SG-04", reason: `Draft status is "${status}", must be "approved" before send` };
  }
  return { passed: true };
}

export function checkFollowUpAutoSend(status: string): SafetyCheckResult {
  if (status !== "approved") {
    return { passed: false, gate: "SG-05", reason: "Follow-ups require human approval before sending" };
  }
  return { passed: true };
}
