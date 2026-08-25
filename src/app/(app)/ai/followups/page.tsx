"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, X, Send, AlertCircle, RefreshCw, FileText } from "lucide-react";

interface FollowUp {
  id: string;
  awb: string;
  clearance_type: string;
  trigger_rule: string;
  status: string;
  scheduled_at: string;
  attempt_number: number;
  max_attempts: number;
  draft_id: string | null;
  case_id: string | null;
  assigned_to: string | null;
  created_at: string;
}

interface DraftInfo {
  subject: string;
  body_text: string;
  body_html: string;
  confidence: number;
}

const TRIGGER_LABELS: Record<string, string> = {
  nfbrk_24h: "NFBRK — 24h reminder",
  febrk_48h: "FEBRK — 48h escalation",
  calling_4h: "Calling — 4h callback",
  hold_daily: "Hold — daily check",
  inactive_7d: "Inactive — 7d check-in",
  escalation_2h: "Escalation — 2h urgent",
};

const TRIGGER_COLORS: Record<string, string> = {
  nfbrk_24h: "bg-blue-100 text-blue-700",
  febrk_48h: "bg-orange-100 text-orange-700",
  calling_4h: "bg-amber-100 text-amber-700",
  hold_daily: "bg-purple-100 text-purple-700",
  inactive_7d: "bg-slate-100 text-slate-600",
  escalation_2h: "bg-red-100 text-red-700",
};

export default function FollowUpsPage() {
  const router = useRouter();
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftInfo>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("draft_ready");

  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", status: filter, limit: 50 }),
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setFollowups(data ?? []);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to load" });
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  const generateDraft = async (followup: FollowUp) => {
    try {
      const res = await fetch("/api/ai/followups/generate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followupId: followup.id,
          awb: followup.awb,
          clearanceType: followup.clearance_type,
          triggerRule: followup.trigger_rule,
          attemptNumber: followup.attempt_number,
          maxAttempts: followup.max_attempts,
          caseId: followup.case_id,
        }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      if (data.draft) {
        setDrafts((prev) => ({ ...prev, [followup.id]: data.draft }));
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Generation failed" });
    }
  };

  const approveAndSend = async (followupId: string) => {
    setProcessing(followupId);
    try {
      const res = await fetch("/api/ai/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id: followupId, status: "sent" }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      setFollowups((prev) => prev.map((f) => (f.id === followupId ? { ...f, status: "sent" } : f)));
      setMessage({ type: "success", text: "Follow-up approved and sent" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setProcessing(null);
    }
  };

  const dismiss = async (followupId: string) => {
    setProcessing(followupId);
    try {
      const res = await fetch("/api/ai/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id: followupId, status: "cancelled" }),
      });
      if (!res.ok) throw new Error("Failed to dismiss");
      setFollowups((prev) => prev.map((f) => (f.id === followupId ? { ...f, status: "cancelled" } : f)));
      setMessage({ type: "success", text: "Follow-up dismissed" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setProcessing(null);
    }
  };

  const runProcessor = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process_due" }),
      });
      if (!res.ok) throw new Error("Processor failed");
      setMessage({ type: "success", text: "Due follow-ups processed" });
      fetchFollowUps();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Processor failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-slate-600" />
          <h1 className="text-2xl font-semibold text-slate-900">Follow-ups</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="draft_ready">Ready for review</option>
            <option value="scheduled">Scheduled</option>
            <option value="sent">Sent</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            type="button"
            disabled={loading}
            onClick={runProcessor}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Process due
          </button>
        </div>
      </div>

      {message ? (
        <div className={`mt-4 rounded-md px-4 py-3 text-sm ${
          message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        }`}>
          {message.text}
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {loading && followups.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-sm text-slate-400">Loading...</p>
          </div>
        ) : followups.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <Bell className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">No follow-ups in this status</p>
            <p className="mt-1 text-xs text-slate-400">
              Run "Process due" to find and prepare due follow-ups.
            </p>
          </div>
        ) : (
          followups.map((fu) => {
            const hasDraft = !!drafts[fu.id];
            const colorClass = TRIGGER_COLORS[fu.trigger_rule] ?? "bg-slate-100 text-slate-600";
            const isExpanded = expandedId === fu.id;

            return (
              <div key={fu.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-slate-900">{fu.awb}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
                      {TRIGGER_LABELS[fu.trigger_rule] ?? fu.trigger_rule}
                    </span>
                    <span className="text-xs text-slate-400">
                      Attempt {fu.attempt_number}/{fu.max_attempts}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {fu.status === "draft_ready" && (
                      <>
                        {!hasDraft ? (
                          <button
                            type="button"
                            onClick={() => generateDraft(fu)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <FileText className="h-3 w-3" />
                            Generate draft
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={processing === fu.id}
                            onClick={() => approveAndSend(fu.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <Send className="h-3 w-3" />
                            Approve & send
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={processing === fu.id}
                          onClick={() => dismiss(fu.id)}
                          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    )}
                    {fu.status === "sent" && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Sent
                      </span>
                    )}
                    {fu.status === "cancelled" && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        Dismissed
                      </span>
                    )}
                    {fu.status === "scheduled" && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Scheduled
                      </span>
                    )}
                  </div>
                </div>

                {hasDraft && (
                  <div className="border-t border-slate-100 px-5 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900">
                        {drafts[fu.id].subject}
                      </p>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : fu.id)}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        {isExpanded ? "Collapse" : "Preview"}
                      </button>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {drafts[fu.id].body_text}
                    </p>
                    {isExpanded && (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div
                          className="prose prose-sm max-w-none text-sm text-slate-700"
                          dangerouslySetInnerHTML={{ __html: drafts[fu.id].body_html }}
                        />
                        <p className="mt-2 text-xs text-slate-400">
                          Confidence: {(drafts[fu.id].confidence * 100).toFixed(0)}%
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t border-slate-100 px-5 py-2 text-xs text-slate-400">
                  Scheduled: {new Date(fu.scheduled_at).toLocaleString()} · Created: {new Date(fu.created_at).toLocaleString()}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
