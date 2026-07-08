import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueSend } from "@/lib/queue/enqueue-send";
import { logAudit } from "@/lib/audit/log";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(
      await getCurrentAppUser(),
      "admin",
      "lead",
      "operator",
    );
    const { id } = await params;
    const admin = createAdminClient();

    const { data: batchRun, error: batchError } = await admin
      .from("batch_runs")
      .select("id, status, mailbox_config_id")
      .eq("id", id)
      .single();

    if (batchError || !batchRun) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }
    if (batchRun.status !== "ready") {
      return NextResponse.json(
        { error: `Batch must be "ready" to launch (currently "${batchRun.status}").` },
        { status: 400 },
      );
    }

    const { data: items, error: itemsError } = await admin
      .from("batch_items")
      .select("id")
      .eq("batch_run_id", id)
      .eq("send_status", "pending");

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "There are no pending recipients to send to." },
        { status: 400 },
      );
    }

    await admin.from("batch_runs").update({ status: "queued" }).eq("id", id);

    const limit = pLimit(4);
    const results = await Promise.allSettled(
      items.map((item) =>
        limit(async () => {
          const { qstashMessageId } = await enqueueSend(
            item.id,
            batchRun.mailbox_config_id ?? id,
          );
          if (qstashMessageId) {
            await admin
              .from("batch_items")
              .update({ send_status: "queued", qstash_message_id: qstashMessageId })
              .eq("id", item.id);
          }
        }),
      ),
    );

    const enqueueFailures = results.filter((r) => r.status === "rejected").length;

    await logAudit({
      actorUserId: user.id,
      entityType: "batch_runs",
      entityId: id,
      action: "launch",
      metadata: { itemCount: items.length, enqueueFailures },
    });

    return NextResponse.json({
      queued: items.length - enqueueFailures,
      enqueueFailures,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
