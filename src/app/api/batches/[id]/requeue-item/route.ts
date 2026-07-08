import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueSend } from "@/lib/queue/enqueue-send";
import { logAudit } from "@/lib/audit/log";

const schema = z.object({ batchItemId: z.string().uuid() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(await getCurrentAppUser(), "admin", "lead");
    const { id } = await params;
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "batchItemId is required." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: batchRun } = await admin
      .from("batch_runs")
      .select("mailbox_config_id")
      .eq("id", id)
      .single();

    const { error: resetError } = await admin
      .from("batch_items")
      .update({ send_status: "pending", attempt_count: 0, failure_reason: null })
      .eq("id", parsed.data.batchItemId)
      .eq("batch_run_id", id);

    if (resetError) {
      return NextResponse.json({ error: resetError.message }, { status: 500 });
    }

    const { qstashMessageId } = await enqueueSend(
      parsed.data.batchItemId,
      batchRun?.mailbox_config_id ?? id,
    );
    if (qstashMessageId) {
      await admin
        .from("batch_items")
        .update({ send_status: "queued", qstash_message_id: qstashMessageId })
        .eq("id", parsed.data.batchItemId);
    }

    await logAudit({
      actorUserId: user.id,
      entityType: "batch_items",
      entityId: parsed.data.batchItemId,
      action: "requeue",
      metadata: {},
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
