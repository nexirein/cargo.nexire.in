"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";

export function SendReminderButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/send-reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderLevel: 1 }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Reminder sent successfully");
        router.refresh();
      } else {
        toast.error(data.error ?? "Failed to send reminder");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={sending}
      className="inline-flex items-center gap-1 rounded-md bg-sidebar-primary px-2.5 py-1 text-xs font-medium text-white transition hover:bg-sidebar-primary/90 disabled:opacity-50"
    >
      <Send className="h-3 w-3" />
      {sending ? "Sending..." : "Send reminder"}
    </button>
  );
}
