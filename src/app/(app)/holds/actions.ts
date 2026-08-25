"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseExcelBuffer } from "@/lib/excel/parse";

export async function releaseHold(caseId: string, remarks?: string) {
  const user = await getCurrentAppUser();
  requireRole(user, "admin", "lead", "operator");

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    tp_hold_status: "CLEARED",
    tp_hold_clear_remarks: remarks ?? null,
    tp_hold_cleared_at: now,
    tp_hold_updated_at: now,
    current_status: "awaiting_reply",
  };

  await admin.from("awb_cases").update(update).eq("id", caseId);

  revalidatePath("/holds");
}

// ── Upload hold data ──

export interface UploadRowResult {
  row: number;
  awb: string;
  action: "updated" | "created" | "skipped" | "not_found" | "error";
  reason: string | null;
  status: string | null;
  arrival_source: string | null;
  arrival_date: string | null;
  origin: string | null;
  dest: string | null;
  pieces: string | null;
  error?: string;
}

export interface UploadResult {
  total: number;
  updated: number;
  created: number;
  skipped: number;
  errors: number;
  details: UploadRowResult[];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const HEADER_SYNONYMS: Record<string, string[]> = {
  awb: ["awb", "awb no", "awb number", "airwaybill", "air waybill", "waybill"],
  origin: ["org", "origin", "port of origin", "pol"],
  dest: ["dest", "destination", "port of discharge", "pod"],
  pieces: ["pcs", "pcs arrived", "pieces", "pcs code", "pieceqty"],
  reason: ["reason", "hold reason", "remarks"],
  status: ["stat", "status", "status code", "hold status"],
  arrival_source: ["arrival source", "arrival flight", "flight", "arrival from"],
  arrival_date: ["arrival date", "date arrived", "arrival", "date"],
};

function guessHeaderMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const n = normalize(header);
    for (const [key, synonyms] of Object.entries(HEADER_SYNONYMS)) {
      if (!mapping[key] && synonyms.some((s) => n === s || n.includes(s))) {
        mapping[key] = header;
        break;
      }
    }
  }
  return mapping;
}

export async function uploadHoldData(formData: FormData): Promise<UploadResult> {
  const user = await getCurrentAppUser();
  requireRole(user, "admin", "lead", "operator");

  const file = formData.get("file") as File | null;
  const createMissing = formData.get("createMissing") === "on";
  if (!file) {
    return { total: 0, updated: 0, created: 0, skipped: 0, errors: 0, details: [] };
  }

  const buffer = await file.arrayBuffer();
  let parsed;
  try {
    parsed = await parseExcelBuffer(buffer);
  } catch (e) {
    return { total: 0, updated: 0, created: 0, skipped: 0, errors: 0, details: [] };
  }

  const mapping = guessHeaderMapping(parsed.headers);
  if (!mapping.awb) {
    return { total: 0, updated: 0, created: 0, skipped: 0, errors: 0, details: [] };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const result: UploadResult = { total: 0, updated: 0, created: 0, skipped: 0, errors: 0, details: [] };

  for (const row of parsed.rows) {
    result.total++;
    const awb = (row.values[mapping.awb] ?? "").trim();
    if (!awb) {
      result.skipped++;
      result.details.push({
        row: row.rowNumber,
        awb: "",
        action: "skipped",
        reason: null,
        status: null,
        arrival_source: null,
        arrival_date: null,
        origin: null,
        dest: null,
        pieces: null,
      });
      continue;
    }

    const holdReason = mapping.reason ? (row.values[mapping.reason] ?? "").trim() || null : null;
    const holdStatus = mapping.status ? (row.values[mapping.status] ?? "").trim() || "IMPORTED" : "IMPORTED";
    const arrivalSource = mapping.arrival_source ? (row.values[mapping.arrival_source] ?? "").trim() || null : null;
    const rawArrivalDate = mapping.arrival_date ? (row.values[mapping.arrival_date] ?? "").trim() || null : null;
    const origin = mapping.origin ? (row.values[mapping.origin] ?? "").trim() || null : null;
    const dest = mapping.dest ? (row.values[mapping.dest] ?? "").trim() || null : null;
    const pieces = mapping.pieces ? (row.values[mapping.pieces] ?? "").trim() || null : null;

    try {
      const updatePayload: Record<string, unknown> = {
        tp_hold_reason: holdReason,
        tp_hold_status: holdStatus,
        tp_hold_arrival_source: arrivalSource,
        tp_hold_updated_at: now,
        current_status: "hold",
      };
      if (origin) updatePayload.origin_port = origin;
      if (dest) updatePayload.dest_port = dest;

      const { data: existing } = await admin
        .from("awb_cases")
        .select("id, shipment_phase")
        .eq("awb", awb)
        .maybeSingle();

      if (existing) {
        const phases: string[] = existing.shipment_phase ?? ["pre_alert"];
        if (!phases.includes("post_arrival")) {
          phases.push("post_arrival");
          updatePayload.shipment_phase = phases;
        }
        await admin.from("awb_cases").update(updatePayload).eq("id", existing.id);
        result.updated++;
        result.details.push({
          row: row.rowNumber,
          awb,
          action: "updated",
          reason: holdReason,
          status: holdStatus,
          arrival_source: arrivalSource,
          arrival_date: rawArrivalDate,
          origin,
          dest,
          pieces,
        });
      } else if (createMissing) {
        await admin.from("awb_cases").insert({
          awb,
          ...updatePayload,
          shipment_phase: ["pre_alert", "post_arrival"],
          current_status: "hold",
        });
        result.created++;
        result.details.push({
          row: row.rowNumber,
          awb,
          action: "created",
          reason: holdReason,
          status: holdStatus,
          arrival_source: arrivalSource,
          arrival_date: rawArrivalDate,
          origin,
          dest,
          pieces,
        });
      } else {
        result.skipped++;
        result.details.push({
          row: row.rowNumber,
          awb,
          action: "not_found",
          reason: holdReason,
          status: holdStatus,
          arrival_source: arrivalSource,
          arrival_date: rawArrivalDate,
          origin,
          dest,
          pieces,
        });
      }
    } catch (e) {
      result.errors++;
      result.details.push({
        row: row.rowNumber,
        awb,
        action: "error",
        reason: holdReason,
        status: holdStatus,
        arrival_source: arrivalSource,
        arrival_date: rawArrivalDate,
        origin,
        dest,
        pieces,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  revalidatePath("/holds");
  return result;
}
