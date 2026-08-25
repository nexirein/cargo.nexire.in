export interface ClearanceMasterEntry {
  company_name: string;
  clearance_type: string;
  source: string;
  email: string | null;
  times_seen?: number;
}

export interface BrokerMasterEntry {
  company_name_normalized: string;
  broker_type: string;
  broker_name: string | null;
  match_type?: string;
}

export interface BrokerPatternEntry {
  pattern: string;
  broker_type: string;
  broker_name: string | null;
}

export interface ResolutionResult {
  clearanceType: string | null;
  broker: string | null;
  email: string | null;
  source: string;
  confidence: "high" | "medium";
  resolvedCt: boolean;
  resolvedBroker: boolean;
  resolvedEmail: boolean;
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\*[^*]*\*/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(private limited|pvt\.?\s*ltd\.?|pvt|limited|ltd|plc|llc|inc|corporation|corp|company|co\.?)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractSearchableKeywords(name: string): string[] {
  const normalized = normalizeCompanyName(name);
  return normalized.split(/\s+/).filter((w) => w.length >= 3);
}

export function extractEmails(value: string): string[] {
  if (!value || value === "0" || value === "#N/A" || value === ";;") return [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return [...value.matchAll(emailRegex)].map((m) => m[0]);
}

export function isValidPhone(value: string): string | null {
  if (!value || value === "0" || value === "#N/A") return null;
  const digits = value.replace(/[^0-9]/g, "");
  if (digits === "91" || digits.length < 10) return null;
  if (digits.length === 10) return "+91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return "+" + digits;
  return digits;
}

export function hasContent(val: string | null | undefined): boolean {
  return !!val && val !== "0" && val !== "#N/A" && val !== ";;";
}

export function findFirstEmail(...values: (string | null)[]): string | null {
  for (const v of values) {
    if (hasContent(v)) {
      const emails = extractEmails(v!);
      if (emails.length > 0) return emails[0];
    }
  }
  return null;
}

export interface MasterIndex {
  exact: Map<string, ClearanceMasterEntry>;
  keyword: Map<string, ClearanceMasterEntry[]>;
}

export function buildMasterIndex(clearanceMaster: ClearanceMasterEntry[]): MasterIndex {
  const exact = new Map<string, ClearanceMasterEntry>();
  const keyword = new Map<string, ClearanceMasterEntry[]>();

  for (const cm of clearanceMaster) {
    const key = normalizeCompanyName(cm.company_name as unknown as string);
    if (!exact.has(key) || (cm.times_seen ?? 0) > 0) {
      exact.set(key, cm);
    }

    const keywords = extractSearchableKeywords(cm.company_name as unknown as string);
    for (const kw of keywords) {
      if (!keyword.has(kw)) keyword.set(kw, []);
      keyword.get(kw)!.push(cm);
    }
  }

  return { exact, keyword };
}

export interface BrokerIndex {
  exact: Map<string, { broker_type: string; broker_name: string | null }>;
  patterns: BrokerPatternEntry[];
}

export function buildBrokerIndex(brokerMaster: BrokerMasterEntry[]): BrokerIndex {
  const exact = new Map<string, { broker_type: string; broker_name: string | null }>();
  const patterns: BrokerPatternEntry[] = [];

  for (const bm of brokerMaster) {
    if (bm.match_type === "pattern") {
      patterns.push({ pattern: bm.company_name_normalized, broker_type: bm.broker_type, broker_name: bm.broker_name });
    } else {
      const key = bm.company_name_normalized;
      if (!exact.has(key)) {
        exact.set(key, { broker_type: bm.broker_type, broker_name: bm.broker_name });
      }
    }
  }

  return { exact, patterns };
}

const HARDCODED_BROKER_RULES: { keyword: string; brokerName: string; clearanceType: string }[] = [
  { keyword: "air india", brokerName: "HC khanna", clearanceType: "febrk" },
  { keyword: "airindia", brokerName: "HC khanna", clearanceType: "febrk" },
];

export function resolveClearanceFromMaster(
  companyName: string,
  endResult: string | null,
  fedexBroker: string | null,
  masterIndex: MasterIndex,
  brokerIndex: BrokerIndex,
): { clearanceType: string | null; broker: string | null; source: string; confidence: "high" | "medium" } {
  let clearanceType: string | null = null;
  let broker: string | null = null;
  let source = "";
  let confidence: "high" | "medium" = "high";

  // Level 1: End Result column
  if (endResult) {
    const upper = endResult.toUpperCase().trim();
    if (upper === "CALLING" || upper.startsWith("CALLING")) {
      // calling — skip to master
    } else if (upper === "HOLD" || upper.startsWith("HOLD")) {
      // hold — skip
    } else if (upper.startsWith("FEBRK")) {
      if (upper.includes("SUNIMPEX")) {
        clearanceType = "febrk-sunimpex";
        broker = "Sunimpex";
        source = "excel";
      } else if (upper.includes("JEENA")) {
        clearanceType = "febrk-jeena";
        broker = "Jeena";
        source = "excel";
      } else if (fedexBroker) {
        const upperb = fedexBroker.toUpperCase();
        if (upperb.includes("JEENA")) {
          clearanceType = "febrk-jeena";
          broker = "Jeena";
          source = "excel+broker";
        } else if (upperb.includes("SUNIMPEX") || upperb.includes("SUNIM")) {
          clearanceType = "febrk-sunimpex";
          broker = "Sunimpex";
          source = "excel+broker";
        }
      }
    } else if (upper === "NFBRK" || upper.startsWith("NFBRK")) {
      clearanceType = "nfbrk";
      source = "excel";
    }
  }

  if (clearanceType) return { clearanceType, broker, source, confidence };

  // Level 2: Master data exact match
  if (companyName) {
    const normalized = normalizeCompanyName(companyName);
    const exactMatch = masterIndex.exact.get(normalized);

    if (exactMatch) {
      const ct = exactMatch.clearance_type;
      if (ct === "febrk") {
        const bm = brokerIndex.exact.get(normalized);
        if (bm) {
          clearanceType = bm.broker_type;
          broker = bm.broker_name ?? (bm.broker_type === "febrk-jeena" ? "Jeena" : "Sunimpex");
          source = `master_db+broker (${bm.broker_type})`;
        } else {
          source = `master_db (febrk)`;
        }
      } else {
        clearanceType = ct;
        source = `master_db (${exactMatch.source})`;
        if (ct === "febrk-jeena") broker = "Jeena";
        if (ct === "febrk-sunimpex") broker = "Sunimpex";
      }
    }

    if (clearanceType) return { clearanceType, broker, source, confidence };

    // Level 3: Keyword fuzzy match
    const keywords = extractSearchableKeywords(companyName);
    const allKeywordEntries = keywords.flatMap((kw) => masterIndex.keyword.get(kw) ?? []);

    if (allKeywordEntries.length >= Math.max(1, Math.floor(keywords.length * 0.5))) {
      const typeCounts = new Map<string, { type: string; src: string; count: number }>();
      for (const entry of allKeywordEntries) {
        const key = entry.clearance_type;
        const existing = typeCounts.get(key) ?? { type: key, src: entry.source, count: 0 };
        existing.count++;
        typeCounts.set(key, existing);
      }
      const best = [...typeCounts.entries()].sort((a, b) => b[1].count - a[1].count)[0][1];
      if (best.type !== "febrk") {
        clearanceType = best.type;
        source = `master_db_fuzzy (${best.src})`;
        confidence = "medium";
        if (best.type === "febrk-jeena") broker = "Jeena";
        if (best.type === "febrk-sunimpex") broker = "Sunimpex";
      }
    }
  }

  return { clearanceType, broker, source, confidence };
}

export function resolveBrokerFromMaster(
  companyName: string,
  fedexBroker: string | null,
  clearanceType: string | null,
  brokerIndex: BrokerIndex,
): { broker: string | null; source: string } {
  if (clearanceType === "nfbrk") return { broker: null, source: "nfbrk_no_broker" };

  let broker: string | null = null;
  let source = "";

  // Level 0: Hardcoded rules
  if (companyName) {
    const upper = companyName.toUpperCase();
    for (const rule of HARDCODED_BROKER_RULES) {
      if (upper.includes(rule.keyword.toUpperCase())) {
        broker = rule.brokerName;
        source = `rule (${rule.keyword} → ${rule.brokerName})`;
        return { broker, source };
      }
    }
  }

  // Level 1: Pattern-based broker rules
  if (!broker && companyName) {
    const upper = companyName.toUpperCase();
    for (const bp of brokerIndex.patterns) {
      if (upper.includes(bp.pattern.toUpperCase())) {
        broker = bp.broker_name ?? (bp.broker_type === "febrk-jeena" ? "Jeena" : "Sunimpex");
        source = `broker_rule (${bp.pattern} → ${broker})`;
        return { broker, source };
      }
    }
  }

  // Level 2: FedEx Broker column
  if (!broker && fedexBroker) {
    const upperb = fedexBroker.toUpperCase();
    if (upperb.includes("JEENA")) {
      broker = "Jeena";
      source = "excel+broker";
    } else if (upperb.includes("SUNIMPEX") || upperb.includes("SUNIM")) {
      broker = "Sunimpex";
      source = "excel+broker";
    } else {
      broker = fedexBroker;
      source = "excel+broker";
    }
    if (broker) return { broker, source };
  }

  // Level 3: Broker master exact match
  if (!broker && companyName) {
    const normalized = normalizeCompanyName(companyName);
    const match = brokerIndex.exact.get(normalized);
    if (match) {
      broker = match.broker_name ?? (match.broker_type === "febrk-jeena" ? "Jeena" : "Sunimpex");
      source = `broker_master (${match.broker_type})`;
    }
  }

  return { broker, source };
}

export function resolveEmailFromMaster(
  companyName: string,
  masterIndex: MasterIndex,
): string | null {
  if (!companyName) return null;
  const normalized = normalizeCompanyName(companyName);
  const entry = masterIndex.exact.get(normalized);
  if (entry?.email) {
    const emails = extractEmails(entry.email);
    if (emails.length > 0) return emails[0];
  }
  return null;
}

export function categorizeSource(
  source: string,
  callReasons: string[],
): string {
  if (callReasons.includes("clearance_type") && !source) return "ai_call";
  if (source.includes("master_db_email")) return "master_db_email";
  if (source.includes("rule")) return "rule";
  if (source.startsWith("excel+broker") || source === "excel") return "excel";
  if (source.startsWith("master_db_fuzzy") || source.includes("fuzzy")) return "master_db_fuzzy";
  if (source.startsWith("master_db") || source.includes("master_db")) return "master_db_exact";
  if (source.includes("remarks") || source.includes("consignee_email") || source.includes("mail_id")) return "email_column";
  if (source.includes("broker") || source === "excel+broker") return "excel";
  return "ai_call";
}
