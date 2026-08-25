import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseExcelBuffer } from "@/lib/excel/parse";
import { guessColumnMapping } from "@/lib/excel/map-rows";
import pLimit from "p-limit";

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(private limited|pvt\.?\s*ltd\.?|pvt|limited|ltd|plc|llc|inc|corporation|corp|company|co\.?)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEmails(value: string): string[] {
  if (!value || value === "0" || value === "#N/A" || value === ";;") return [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return [...value.matchAll(emailRegex)].map((m) => m[0]);
}

function resolveClearanceType(value: string): string | null {
  const upper = value.toUpperCase().trim();
  if (upper === "CALLING" || upper.startsWith("CALLING")) return "calling";
  if (upper === "HOLD" || upper.startsWith("HOLD")) return "hold";
  if (upper.startsWith("FEBRK")) {
    if (upper.includes("SUNIMPEX")) return "febrk-sunimpex";
    if (upper.includes("JEENA")) return "febrk-jeena";
    return "febrk";
  }
  if (upper === "NFBRK" || upper.startsWith("NFBRK")) return "nfbrk";
  if (upper === "COURIER" || upper.startsWith("COURIER")) return null;
  return null;
}

function isValidClearanceType(ct: string | null): boolean {
  return ct === "nfbrk" || ct === "febrk" || ct === "febrk-jeena" || ct === "febrk-sunimpex";
}

export async function POST(request: Request) {
  try {
    const user = requireRole(
      await getCurrentAppUser(),
      "admin",
      "lead",
    );

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const admin = createAdminClient();

    // Parse Excel
    const buffer = await file.arrayBuffer();
    const parsed = await parseExcelBuffer(buffer);
    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: "Excel file has no data rows." }, { status: 400 });
    }

    // Detect columns
    const mapping = guessColumnMapping(parsed.headers);
    const nameCol = mapping.consigneeName;
    const typeCol = mapping.templateType;
    const brokerCol = mapping.fedexBroker;
    const emailCol = mapping.consigneeEmail;
    const remarksCol = mapping.standardRemarks;
    const mailIdCol = mapping.mailId;

    if (!nameCol) {
      return NextResponse.json(
        { error: "Could not detect Consignee Name column.", headers: parsed.headers },
        { status: 400 },
      );
    }

    // Parse rows into master data entries
    const clearanceEntries: { company_name: string; clearance_type: string; source: string }[] = [];
    const brokerEntries: { company_name: string; broker_type: string; broker_name: string | null }[] = [];
    const emailEntries: { company_name: string; email: string }[] = [];

    let skippedCalling = 0;
    let skippedNoType = 0;
    let processed = 0;

    for (const row of parsed.rows) {
      const companyName = (row.values[nameCol] ?? "").toString().trim();
      if (!companyName) continue;

      const endResult = typeCol ? (row.values[typeCol] ?? "").toString().trim() : "";
      const fedexBroker = brokerCol ? (row.values[brokerCol] ?? "").toString().trim() : "";
      const consigneeEmail = emailCol ? (row.values[emailCol] ?? "").toString().trim() : "";
      const standardRemarks = remarksCol ? (row.values[remarksCol] ?? "").toString().trim() : "";
      const mailId = mailIdCol ? (row.values[mailIdCol] ?? "").toString().trim() : "";

      // Extract clearance type
      let ct = resolveClearanceType(endResult);
      if (!ct || !isValidClearanceType(ct)) {
        if (ct === "calling") skippedCalling++;
        else skippedNoType++;
        continue;
      }

      // Refine "febrk" to specific broker type when FedEx Broker column has the info
      let brokerTypeForEntry: string | null = null;
      const validBroker = fedexBroker && fedexBroker !== "0" && fedexBroker !== "#N/A";
      if (ct === "febrk" && validBroker) {
        const upper = fedexBroker.toUpperCase();
        if (upper.includes("SUNIMPEX")) {
          ct = "febrk-sunimpex";
          brokerTypeForEntry = "febrk-sunimpex";
        } else if (upper.includes("JEENA")) {
          ct = "febrk-jeena";
          brokerTypeForEntry = "febrk-jeena";
        }
      }

      clearanceEntries.push({
        company_name: companyName,
        clearance_type: ct,
        source: "excel_upload",
      });

      // Hardcoded rule: Air India → HC khanna
      const companyUpper = companyName.toUpperCase();
      if ((companyUpper.includes("AIR INDIA") || companyUpper.includes("AIRINDIA")) && (ct === "febrk" || ct === "febrk-sunimpex" || ct === "febrk-jeena")) {
        brokerEntries.push({
          company_name: companyName,
          broker_type: "febrk-jeena",
          broker_name: "HC khanna",
        });
      }

      // Extract broker info if FEBRK
      const brokerTypeForLookup = brokerTypeForEntry ?? ct;
      if (brokerTypeForLookup === "febrk-jeena" || brokerTypeForLookup === "febrk-sunimpex") {
        const brokerName = validBroker
          ? fedexBroker
          : (brokerTypeForLookup === "febrk-jeena" ? "Jeena" : "Sunimpex");
        brokerEntries.push({
          company_name: companyName,
          broker_type: brokerTypeForLookup,
          broker_name: brokerName,
        });
      }

      // Extract email — only store actual @ addresses, not notes/phone numbers
      const email = consigneeEmail || standardRemarks || mailId || "";
      const foundEmails = extractEmails(email);
      const cleanEmail = foundEmails.length > 0 ? foundEmails.join("; ") : "";
      if (cleanEmail) {
        emailEntries.push({ company_name: companyName, email: cleanEmail });
      }

      processed++;
    }

    // Upsert into company_clearance_master in batches
    const limit = pLimit(4);
    let clearanceInserted = 0;
    let brokerInserted = 0;

    // Deduplicate clearance entries — keep most common type per company
    const typeCounts = new Map<string, Map<string, number>>();
    for (const entry of clearanceEntries) {
      if (!typeCounts.has(entry.company_name)) {
        typeCounts.set(entry.company_name, new Map());
      }
      const counts = typeCounts.get(entry.company_name)!;
      counts.set(entry.clearance_type, (counts.get(entry.clearance_type) ?? 0) + 1);
    }

    // For each company, pick the most common clearance type
    const bestEntries = [...typeCounts.entries()].map(([company, counts]) => {
      const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        company_name: company,
        clearance_type: best[0],
        source: "excel_upload" as const,
        times_seen: best[1],
        email: null as string | null,
      };
    });

    // For each company, pick the most common email from Standard Remarks / Mail ID
    const emailCounts = new Map<string, Map<string, number>>();
    for (const entry of emailEntries) {
      if (!emailCounts.has(entry.company_name)) {
        emailCounts.set(entry.company_name, new Map());
      }
      const counts = emailCounts.get(entry.company_name)!;
      counts.set(entry.email, (counts.get(entry.email) ?? 0) + 1);
    }
    for (const entry of bestEntries) {
      const companyEmails = emailCounts.get(entry.company_name);
      if (companyEmails && companyEmails.size > 0) {
        const bestEmail = [...companyEmails.entries()]
          .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0];
        entry.email = bestEmail.length > 0 ? bestEmail : null;
      }
    }

    // Upsert clearance master in chunks
    const clearanceChunks: typeof bestEntries[] = [];
    for (let i = 0; i < bestEntries.length; i += 100) {
      clearanceChunks.push(bestEntries.slice(i, i + 100));
    }

    const clearanceResults = await Promise.allSettled(
      clearanceChunks.map((chunk) =>
        limit(async () => {
          for (const entry of chunk) {
            const normalized = normalizeCompanyName(entry.company_name);
            const { data: existing } = await admin
              .from("company_clearance_master")
              .select("id, times_seen")
              .eq("company_name", entry.company_name)
              .maybeSingle();

            if (existing) {
              const updateData: Record<string, unknown> = {
                clearance_type: entry.clearance_type,
                times_seen: (existing.times_seen ?? 0) + entry.times_seen,
                last_seen_at: new Date().toISOString(),
              };
              if (entry.email) updateData.email = entry.email;
              await admin
                .from("company_clearance_master")
                .update(updateData)
                .eq("id", existing.id);
            } else {
              const insertData = { ...entry };
              if (!insertData.email) delete (insertData as Record<string, unknown>).email;
              await admin
                .from("company_clearance_master")
                .insert(insertData);
              clearanceInserted++;
            }
          }
        }),
      ),
    );

    // Upsert broker master in chunks
    const brokerChunks: typeof brokerEntries[] = [];
    for (let i = 0; i < brokerEntries.length; i += 100) {
      brokerChunks.push(brokerEntries.slice(i, i + 100));
    }

    const brokerResults = await Promise.allSettled(
      brokerChunks.map((chunk) =>
        limit(async () => {
          for (const entry of chunk) {
            const normalized = normalizeCompanyName(entry.company_name);
            await admin.from("broker_master").upsert(
              {
                company_name: entry.company_name,
                company_name_normalized: normalized,
                broker_type: entry.broker_type,
                broker_name: entry.broker_name,
                source: "excel_upload",
                confirmed_count: 1,
                last_used_at: new Date().toISOString(),
              },
              { onConflict: "company_name_normalized, broker_type" },
            );
            brokerInserted++;
          }
        }),
      ),
    );

    return NextResponse.json({
      success: true,
      totalRows: parsed.rows.length,
      processed,
      skippedCalling,
      skippedNoType,
      clearanceMasterEntries: bestEntries.length,
      clearanceNew: clearanceInserted,
      brokerEntries: brokerEntries.length,
      brokerNew: brokerInserted,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
