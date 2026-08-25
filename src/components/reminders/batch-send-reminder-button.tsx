"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";

export function BatchSendRemindersButton({ batchId }: { batchId: string }) {
  const [sending, setSending] = useState(false);
  const router = useRouter();

  async function handleSend() {
    if (!confirm("Send reminders to all awaiting cases in this batch?")) return;
    setSending(true);
    try {
      const res = await fetch("/api/batches/" + batchId + "/send-reminders", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.sent + " reminder(s) sent" + (data.failed > 0 ? ", " + data.failed + " failed" : ""));
        router.refresh();
      } else {
        toast.error(data.error ?? "Failed to send reminders");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={sending}
      className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
    >
      <Send className="h-3 w-3" />
      {sending ? "Sending..." : "Send reminders"}
    </button>
  );
}
