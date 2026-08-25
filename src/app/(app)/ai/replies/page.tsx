"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  User,
  Sparkles,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { CLEARANCE_DISPLAY } from "@/lib/cases/clearance-type";

interface AiReply {
  id: string;
  awb: string | null;
  subject: string;
  body: string;
  recipient: string | null;
  classification: {
    clearanceType?: string;
    intent?: string;
    urgency?: string;
    confidence?: number;
  } | null;
  route: string;
  createdAt: string;
  inbound: {
    subject: string;
    body: string;
    sender: string;
    receivedAt: string | null;
  } | null;
  caseInfo: {
    id: string;
    current_status: string;
    issue_type: string | null;
    auto_closed: boolean;
    updated_at: string | null;
  } | null;
}

const URGENCY_STYLE: Record<string, { bg: string; text: string }> = {
  low: { bg: "bg-slate-100", text: "text-slate-600" },
  normal: { bg: "bg-sky-50", text: "text-sky-700" },
  high: { bg: "bg-amber-50", text: "text-amber-700" },
  critical: { bg: "bg-red-50", text: "text-red-700" },
};

export default function AiRepliesPage() {
  const [replies, setReplies] = useState<AiReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AiReply | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReplies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/replies?limit=100");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setReplies(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load replies");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  const [polling, setPolling] = useState(false);
  const [pollMsg, setPollMsg] = useState<string | null>(null);

  const pollNow = async () => {
    setPolling(true);
    setPollMsg(null);
    try {
      const res = await fetch("/api/inbox/poll-now", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Poll failed");
      setPollMsg(
        `Polled mailbox — ${data.emails ?? 0} email(s), ${data.ingested ?? 0} ingested.`,
      );
      fetchReplies();
    } catch (err) {
      setPollMsg(err instanceof Error ? err.message : "Poll failed");
    }
    setPolling(false);
  };

  const today = new Date().toDateString();
  const todayCount = replies.filter(
    (r) => new Date(r.createdAt).toDateString() === today,
  ).length;
  const avgConfidence =
    replies.length > 0
      ? Math.round(
          (replies.reduce(
            (sum, r) => sum + (r.classification?.confidence ?? 0),
            0,
          ) /
            replies.length) *
            100,
        )
      : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Bot className="h-6 w-6 text-indigo-500" />
            AI Auto-Replies
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Every reply the AI sent automatically — what it answered, to whom,
            and why.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={pollNow}
            disabled={polling}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
            aria-label="Poll mailbox now"
          >
            <RefreshCw className={`h-4 w-4 ${polling ? "animate-spin" : ""}`} />
            {polling ? "Polling…" : "Poll mailbox now"}
          </button>
          <button
            onClick={fetchReplies}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {pollMsg && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {pollMsg}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total AI replies</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{replies.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white p-5">
          <p className="text-sm text-emerald-600">Replied today</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{todayCount}</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-white p-5">
          <p className="text-sm text-indigo-600">Avg confidence</p>
          <p className="mt-2 text-3xl font-semibold text-indigo-700">{avgConfidence}%</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
          ) : replies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Bot className="mb-4 h-12 w-12 text-slate-300" />
              <p className="text-slate-500">No AI auto-replies yet.</p>
              <p className="mt-1 text-xs text-slate-400">
                When the AI answers a customer query automatically, it will appear here.
              </p>
            </div>
          ) : (
            replies.map((r) => {
              const conf = r.classification?.confidence ?? 0;
              const ct = r.classification?.clearanceType ?? "";
              const ctStyle = CLEARANCE_DISPLAY[ct];
              const urgency = r.classification?.urgency ?? "";
              const urStyle = URGENCY_STYLE[urgency] ?? URGENCY_STYLE.normal;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`w-full rounded-xl border p-4 text-left transition-all ${
                    selected?.id === r.id
                      ? "border-indigo-300 bg-indigo-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {r.inbound?.sender ?? r.recipient ?? "Unknown"}
                        </p>
                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {r.subject || "(no subject)"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {r.awb && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600">
                            {r.awb}
                          </span>
                        )}
                        {ctStyle ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${ctStyle.bg} ${ctStyle.text}`}>
                            {ctStyle.label}
                          </span>
                        ) : null}
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${urStyle.bg} ${urStyle.text}`}>
                          {urgency || "normal"}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            conf >= 0.9
                              ? "bg-green-100 text-green-700"
                              : conf >= 0.7
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {Math.round(conf * 100)}%
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">
                        {new Date(r.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {selected && (
          <div className="h-fit rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Reply details</h2>
              <span className="text-xs text-slate-400">
                {new Date(selected.createdAt).toLocaleString()}
              </span>
            </div>

            <div className="space-y-5 px-5 py-4">
              <div className="rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Customer query
                  </span>
                </div>
                <div className="space-y-2 p-3">
                  {selected.inbound ? (
                    <>
                      <p className="text-xs text-slate-500">{selected.inbound.sender}</p>
                      <p className="text-sm font-medium text-slate-900">
                        {selected.inbound.subject}
                      </p>
                      <p className="whitespace-pre-wrap text-sm text-slate-600">
                        {selected.inbound.body}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">Inbound email not found.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-indigo-200">
                <div className="flex items-center gap-2 border-b border-indigo-100 bg-indigo-50 px-3 py-2">
                  <Bot className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-[11px] font-medium uppercase tracking-wide text-indigo-500">
                    AI reply (sent automatically)
                  </span>
                </div>
                <div className="space-y-2 p-3">
                  <p className="text-sm font-medium text-slate-900">{selected.subject}</p>
                  <p className="whitespace-pre-wrap text-sm text-slate-600">
                    {selected.body || selected.subject}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                  <Sparkles className="h-3 w-3" />
                  Route: {selected.route}
                </span>
                {selected.classification?.intent && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">
                    intent: {selected.classification.intent}
                  </span>
                )}
                {selected.caseInfo?.auto_closed ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <ShieldCheck className="h-3 w-3" />
                    Case auto-closed
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                    Case: {selected.caseInfo?.current_status ?? "n/a"}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}