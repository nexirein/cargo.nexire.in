import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireRole(await getCurrentAppUser(), "admin", "lead");
    const { id } = await params;
    const admin = createAdminClient();
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.company_name) updates.company_name = body.company_name.toString().trim();
    if (body.broker_type) updates.broker_type = body.broker_type.toString().trim();
    if (body.broker_name) updates.broker_name = body.broker_name.toString().trim();
    if (body.match_type) updates.match_type = body.match_type.toString().trim();
    if (body.company_name) {
      updates.company_name_normalized = body.company_name.toString().trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    const { data, error } = await admin
      .from("broker_master")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ rule: data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireRole(await getCurrentAppUser(), "admin", "lead");
    const { id } = await params;
    const admin = createAdminClient();

    const { error } = await admin
      .from("broker_master")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
