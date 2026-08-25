import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    requireRole(await getCurrentAppUser(), "admin", "lead");
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("broker_master")
      .select("*")
      .order("match_type", { ascending: true })
      .order("company_name");

    if (error) throw error;

    return NextResponse.json({ rules: data ?? [] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireRole(await getCurrentAppUser(), "admin", "lead");
    const admin = createAdminClient();
    const body = await request.json();

    const companyName = (body.company_name ?? "").toString().trim();
    const brokerType = (body.broker_type ?? "").toString().trim();
    const brokerName = (body.broker_name ?? "").toString().trim();
    const matchType = (body.match_type ?? "exact").toString().trim();

    if (!companyName || !brokerType || !brokerName) {
      return NextResponse.json({ error: "company_name, broker_type, broker_name are required" }, { status: 400 });
    }
    if (!["febrk-jeena", "febrk-sunimpex"].includes(brokerType)) {
      return NextResponse.json({ error: "broker_type must be febrk-jeena or febrk-sunimpex" }, { status: 400 });
    }
    if (!["exact", "pattern"].includes(matchType)) {
      return NextResponse.json({ error: "match_type must be exact or pattern" }, { status: 400 });
    }

    const normalized = companyName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const { data, error } = await admin
      .from("broker_master")
      .upsert({
        company_name: companyName,
        company_name_normalized: normalized,
        broker_type: brokerType,
        broker_name: brokerName,
        match_type: matchType,
        source: "manual",
        confirmed_count: 1,
        last_used_at: new Date().toISOString(),
      }, { onConflict: "company_name_normalized, broker_type" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ rule: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
