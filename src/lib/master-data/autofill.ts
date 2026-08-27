import { resolveClearanceType } from "@/lib/cases/clearance-type";
import {
  normalizeCompanyName,
  extractSearchableKeywords,
  extractEmails,
  hasContent,
  findFirstEmail,
  type MasterIndex,
  type BrokerIndex,
} from "@/lib/master-data/resolve";

export interface AutofillInput {
  companyName: string;
  /** Raw "End Result" / template-type cell from the Excel sheet. */
  endResult: string | null;
  /** Raw FedEx Broker cell, already cleaned of "0"/"#N/A"/"0.0". */
  fedexBroker: string | null;
  /** Consignee email column raw value. */
  email: string;
  standardRemarks: string | null;
  mailId: string | null;
}

export interface AutofillResult {
  clearanceType: string | null;
  broker: string | null;
  email: string | null;
  source: string;
  confidence: "high" | "medium" | "low";
  callReasons: string[];
}

/**
 * One shared resolver used by BOTH the /clearance-fill upload route and the
 * /batches/[id]/validate route so their auto-fill behaviour stays identical.
 *
 * CHAIN 1 — Clearance type:  End Result cell → master exact → master fuzzy.
 * CHAIN 2 — FedEx broker:    hardcoded rules → broker patterns → Excel broker
 *                             column → broker master (only for FEBRK).
 * CHAIN 3 — Consignee email:  email column → Standard Remarks → Mail ID →
 *                             master DB email.
 *
 * Returns whatever cells can be auto-filled from company name / fuzzy match
 * plus a `callReasons` set describing what still needs human / AI calls.
 */
export function autofillShipmentRow(
  input: AutofillInput,
  masterIdx: MasterIndex,
  brokerIdx: BrokerIndex,
): AutofillResult {
  const { companyName, endResult, fedexBroker, email, standardRemarks, mailId } = input;

  const clearanceMaster = masterIdx.exact;
  const keywordIndex = masterIdx.keyword;
  const brokerIndex = brokerIdx.exact;
  const brokerPatterns = brokerIdx.patterns;

  const callReasons: string[] = [];
  let clearanceType: string | null = null;
  let broker: string | null = null;
  let resolvedEmail: string | null = null;
  let source = "";
  let confidence: "high" | "medium" | "low" = "low";
  let ctSource = "";
  let ctConfidence: "high" | "medium" = "high";

  // ════════════════════════════════════════════════════════════
  // CHAIN 1: Clearance Type Resolution
  // ════════════════════════════════════════════════════════════
  if (endResult) {
    const resolvedCt = resolveClearanceType(endResult);
    if (resolvedCt === "calling" || resolvedCt === "hold") {
      clearanceType = resolvedCt;
      ctSource = "excel";
    } else if (resolvedCt && resolvedCt !== "febrk") {
clearanceType = resolvedCt;
      ctSource = "excel";
      if (resolvedCt === "febrk-jeena") broker = "Jeena";
      if (resolvedCt === "febrk-sunimpex") broker = "Sunimpex";
    } else if (resolvedCt === "febrk") {
      // FEBRK — check FedEx Broker column for Jeena/Sunimpex qualifier
      if (fedexBroker) {
        const upperb = fedexBroker.toUpperCase();
        if (upperb.includes("JEENA")) {
          clearanceType = "febrk-jeena";
          broker = "Jeena";
          ctSource = "excel";
        } else if (upperb.includes("SUNIMPEX") || upperb.includes("SUNIM")) {
          clearanceType = "febrk-sunimpex";
          broker = "Sunimpex";
          ctSource = "excel";
        }
      }
    }
  }

  // Level 2: Master data exact match
  if (!clearanceType && companyName) {
    const normalized = normalizeCompanyName(companyName);
    const exactMatch = clearanceMaster.get(normalized);

    if (exactMatch) {
      if (exactMatch.clearance_type === "febrk") {
        // FEBRK from master — try broker master
        const brokerMatch = brokerIndex.get(normalized);
        if (brokerMatch) {
          clearanceType = brokerMatch.broker_type;
          broker = brokerMatch.broker_name ?? (brokerMatch.broker_type === "febrk-jeena" ? "Jeena" : "Sunimpex");
          ctSource = `master_db+broker (${brokerMatch.broker_type})`;
        } else {
          // Master says FEBRK but no broker known — needs calling
          ctSource = "master_db (febrk)";
        }
      } else {
        clearanceType = exactMatch.clearance_type;
        ctSource = `master_db (${exactMatch.source})`;
        if (exactMatch.clearance_type === "febrk-jeena") broker = "Jeena";
        if (exactMatch.clearance_type === "febrk-sunimpex") broker = "Sunimpex";
      }
    }
  }

  // Level 3: Fuzzy match across all keyword entries (no single-company pollution)
  if (!clearanceType && companyName) {
    const keywords = extractSearchableKeywords(companyName);
    const allKeywordEntries = keywords.flatMap((kw) => keywordIndex.get(kw) ?? []);

    if (allKeywordEntries.length >= Math.max(1, Math.floor(keywords.length * 0.5))) {
      const typeCounts = new Map<string, { type: string; source: string; count: number }>();
      for (const entry of allKeywordEntries) {
        const key = entry.clearance_type;
        const existing = typeCounts.get(key) ?? { type: key, source: entry.source, count: 0 };
        existing.count++;
        typeCounts.set(key, existing);
      }
      const best = [...typeCounts.entries()].sort((a, b) => b[1].count - a[1].count)[0][1];
      if (best.type !== "febrk") {
        clearanceType = best.type;
        ctSource = `master_db_fuzzy (${best.source})`;
        ctConfidence = "medium";
        if (best.type === "febrk-jeena") broker = "Jeena";
        if (best.type === "febrk-sunimpex") broker = "Sunimpex";
      }
    }
  }

  if (!clearanceType) {
    callReasons.push("clearance_type");
  }

  // ════════════════════════════════════════════════════════════
  // CHAIN 2: FedEx Broker Resolution (FEBRK only)
  // ════════════════════════════════════════════════════════════
  const needsBroker =
    !broker &&
    (clearanceType === "febrk" ||
      clearanceType === "febrk-jeena" ||
      clearanceType === "febrk-sunimpex" ||
      !clearanceType);

  if (clearanceType === "nfbrk") {
    // No broker needed for NFBRK
  } else if (needsBroker) {
    // Level 0: Hardcoded rules for known companies
    const companyUpper = companyName.toUpperCase();
    if (companyUpper.includes("AIR INDIA") || companyUpper.includes("AIRINDIA")) {
      broker = "HC khanna";
      if (!clearanceType) {
        clearanceType = "febrk";
        ctSource = "rule (AIR INDIA → HC khanna)";
      }
    }

    // Level 1: Brand-based broker rules from broker_master UI
    if (!broker && companyName) {
      for (const bp of brokerPatterns) {
        if (companyUpper.includes(bp.pattern.toUpperCase())) {
          broker = bp.broker_name ?? (bp.broker_type === "febrk-jeena" ? "Jeena" : "Sunimpex");
          if (!clearanceType) {
            clearanceType = bp.broker_type;
            ctSource = `broker_rule (${bp.pattern} → ${bp.broker_name})`;
          }
          break;
        }
      }
    }

    // Level 2: FedEx Broker column in Excel
    if (!broker && fedexBroker) {
      const upperb = fedexBroker.toUpperCase();
      if (upperb.includes("JEENA")) {
        broker = "Jeena";
        if (!clearanceType) {
          clearanceType = "febrk-jeena";
          ctSource = "excel+broker";
        }
      } else if (upperb.includes("SUNIMPEX") || upperb.includes("SUNIM")) {
        broker = "Sunimpex";
        if (!clearanceType) {
          clearanceType = "febrk-sunimpex";
          ctSource = "excel+broker";
        }
      } else {
        broker = fedexBroker;
      }
    }

    // Level 3: Broker master exact lookup
    if (!broker && companyName) {
      const normalized = normalizeCompanyName(companyName);
      const brokerMatch = brokerIndex.get(normalized);
      if (brokerMatch) {
        broker = brokerMatch.broker_name ?? (brokerMatch.broker_type === "febrk-jeena" ? "Jeena" : "Sunimpex");
        if (!clearanceType) {
          clearanceType = brokerMatch.broker_type;
          ctSource = `broker_master (${brokerMatch.broker_type})`;
        }
      }
    }
  }

  if (needsBroker && !broker) {
    callReasons.push("broker");
  }

  // Set source based on clearance type resolution
  if (clearanceType && !source) {
    source = ctSource;
    confidence = ctConfidence;
  }

  // ════════════════════════════════════════════════════════════
  // CHAIN 3: Consignee Email Resolution
  // Email column → Standard Remarks → Mail ID (priority)
  // Falls back to master DB email when all 3 are empty / no valid @ found.
  // Only flags an AI call when no valid @ found anywhere.
  // ════════════════════════════════════════════════════════════
  const foundEmail = findFirstEmail(email, standardRemarks, mailId);
  if (foundEmail) {
    resolvedEmail = foundEmail;
    if (hasContent(email) && extractEmails(email).length > 0) {
      source = "consignee_email_column";
    } else if (hasContent(standardRemarks) && extractEmails(standardRemarks ?? "").length > 0) {
      source = source ? source + "+remarks" : "remarks";
    } else if (hasContent(mailId) && extractEmails(mailId ?? "").length > 0) {
      source = source ? source + "+mail_id" : "mail_id";
    }
  }

  // No valid @ found in any Excel column — fallback to master DB
  if (!resolvedEmail && companyName) {
    const normalized = normalizeCompanyName(companyName);
    const masterEntry = clearanceMaster.get(normalized);
    if (masterEntry?.email) {
      const emails = extractEmails(masterEntry.email);
      if (emails.length > 0) {
        resolvedEmail = emails[0];
        source = source ? source + "+master_db_email" : "master_db_email";
      }
    }
  }

  // Only flag an AI call when no email could be resolved from any source
  if (!resolvedEmail) {
    callReasons.push("email");
  }

  return { clearanceType, broker, email: resolvedEmail, source, confidence, callReasons };
}

export interface AutofillResult {
  clearanceType: string | null;
  broker: string | null;
  email: string | null;
  source: string;
  confidence: "high" | "medium" | "low";
  callReasons: string[];
}