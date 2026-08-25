"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Send,
  X,
  Check,
  Edit3,
  AlertCircle,
  RefreshCw,
  Search,
  Mail,
  User,
  Bot,
  Inbox,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { CLEARANCE_DISPLAY } from "@/lib/cases/clearance-type";

interface Draft {
  id: string;
  case_id: string | null;
  email_event_id: string | null;
  trigger_type: string;
  trigger_reason: string | null;
  subject: string;
  body_html: string;
  body_text: string;
  confidence: number;
  flags: string[];
  status: string;
  created_at: string;
  sender_email?: string | null;
  consignee_email?: string | null;
  inbound_subject?: string | null;
  inbound_body?: string | null;
  inbound_received_at?: string | null;
  awb?: string | null;
  case_status?: string | null;
  classification?: {
    route?: string;
    confidence?: number;
    clearance_type?: string;
    intent?: string;
    urgency?: string;
    explanation?: string;
  } | null;
}

const STATUS_TABS = [
  { key: "pending", label: "Pending" },
  { key: "edited", label: "Edited" },
  { key: "approved", label: "Approved" },
  { key: "sent", label: "Sent" },
  { key: "rejected", label: "Rejected" },
] as const;

const URGENCY_STYLE: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  normal: "bg-sky-50 text-sky-700",
  high: "bg-amber-50 text-amber-700",
  critical: "bg-red-50 text-red-700",
};

const CLEARANCE_LABEL: Record<string, string> = {
  nfbrk: "NFBRK",
  febrk: "FEBRK",
  "febrk-sunimpex": "FEBRK-Sunimpex",
  "febrk-jeena": "FEBRK-Jeena",
  calling: "Calling",
  hold: "HOLD",
};

function formatTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const opts: Intl.DateTimeFormatOptions = sameDay
    ? { hour: "numeric", minute: "2-digit" }
    : { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" };
  return new Intl.DateTimeFormat("en-IN", opts).format(d);
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/drafts?status=${filterStatus}&limit=100`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setDrafts(data?.drafts ?? []);
      setCounts(data?.counts ?? {});
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to load drafts" });
    }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const handleAction = async (
    draftId: string,
    action: "approve" | "reject" | "edit",
    reason?: string,
  ) => {
    setProcessing(draftId);
    try {
      const res = await fetch("/api/ai/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          action,
          reason,
          editedSubject: action === "approve" && editMode ? editSubject : undefined,
          editedBody: action === "approve" && editMode ? editBody : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");

      setMessage({ type: "success", text: `Draft ${action}d successfully` });
      setSelectedDraft(null);
      setEditMode(false);
      fetchDrafts();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Action failed" });
    }
    setProcessing(null);
  };

  const openDraft = (draft: Draft) => {
    setSelectedDraft(draft);
    setEditMode(false);
    setEditSubject(draft.subject);
    setEditBody(draft.body_html);
  };

  const q = search.trim().toLowerCase();
  const filteredDrafts = drafts.filter((d) => {
    if (!q) return true;
    return (
      d.awb?.toLowerCase().includes(q) ||
      d.sender_email?.toLowerCase().includes(q) ||
      d.subject.toLowerCase().includes(q)
    );
  });

  const selected = selectedDraft;
  const canSend = !!selected?.sender_email || !!selected?.consignee_email;
  const cls = selected?.classification;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <FileText className="h-6 w-6 text-indigo-500" />
            AI Drafts
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Replies the AI prepared for customer emails — review, edit, and send.
          </p>
        </div>
        <button
          onClick={fetchDrafts}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            message.type === "success"
              ? "border border-green-200 bg-green-50 text-green-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.type === "success" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Status tabs with counts */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => {
          const active = filterStatus === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setFilterStatus(tab.key);
                setSelectedDraft(null);
                setEditMode(false);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                active
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 text-xs ${
                  active ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {counts[tab.key] ?? 0}
              </span>
            </button>
          );
        })}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search AWB, email, subject…"
            className="w-72 rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* List */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Inbox className="h-12 w-12 text-slate-300" />
              <p className="mt-3 text-slate-500">
                No {filterStatus} drafts
                {q ? ` matching "${search}"` : ""}
              </p>
            </div>
          ) : (
            filteredDrafts.map((draft) => (
              <button
                key={draft.id}
                onClick={() => openDraft(draft)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  selected?.id === draft.id
                    ? "border-indigo-300 bg-indigo-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{draft.subject}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {draft.awb ? `AWB ${draft.awb}` : ""}
                      {draft.sender_email ? ` · ${draft.sender_email}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          draft.confidence >= 0.9
                            ? "bg-green-100 text-green-700"
                            : draft.confidence >= 0.7
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {Math.round(draft.confidence * 100)}%
                      </span>
                      {draft.classification?.clearance_type && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                          {CLEARANCE_LABEL[draft.classification.clearance_type] ??
                            draft.classification.clearance_type}
                        </span>
                      )}
                      {draft.classification?.intent && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">
                          {draft.classification.intent.replace(/_/g, " ")}
                        </span>
                      )}
                      {draft.flags?.includes("low_confidence_draft") && (
                        <span className="text-xs font-medium text-red-500">⚠ Low confidence</span>
                      )}
                      <span className="ml-auto text-xs text-slate-400">
                        {formatTime(draft.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail: email thread */}
        {selected && (
          <div className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-0 shadow-sm">
            {/* Customer's message */}
            <div className="rounded-t-xl border-b border-slate-100 bg-slate-50/60 p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                  <User className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {selected.sender_email ?? "Unknown sender"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selected.inbound_received_at
                      ? formatTime(selected.inbound_received_at)
                      : "inbound email not available"}
                  </p>
                </div>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                  Customer
                </span>
              </div>
              <p className="text-sm font-medium text-slate-800">
                {selected.inbound_subject ?? "(no subject)"}
              </p>
              <div className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-sm leading-relaxed text-slate-700 ring-1 ring-slate-200">
                {selected.inbound_body || "Original customer email unavailable for this draft."}
              </div>
              {selected.awb && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    AWB {selected.awb}
                  </span>
                  {selected.case_status && (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      Case: {selected.case_status.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 px-5">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                <Bot className="h-3.5 w-3.5" /> AI draft reply
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* AI reply */}
            <div className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                  <Bot className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">FedEx AI Assistant</p>
                  <p className="text-xs text-slate-500">
                    {selected.email_event_id ? "Awaiting review before sending" : "Generated draft"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      selected.confidence >= 0.9
                        ? "bg-green-100 text-green-700"
                        : selected.confidence >= 0.7
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {Math.round(selected.confidence * 100)}% confidence
                  </span>
                  {cls?.urgency && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        URGENCY_STYLE[cls.urgency] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {cls.urgency}
                    </span>
                  )}
                </div>
              </div>

              {/* Classification + flags line */}
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {cls && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {CLEARANCE_LABEL[cls.clearance_type ?? ""] ?? cls.clearance_type ?? "?"} ·{" "}
                    {cls.intent ?? "?"} · route: {(cls.route ?? "?").replace(/_/g, " ")}
                  </span>
                )}
                {selected.flags?.map((f) => (
                  <span key={f} className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                    {f.replace(/_/g, " ")}
                  </span>
                ))}
              </div>

              {/* Editable subject + body */}
              {editMode ? (
                <>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Subject</label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <label className="mb-1 block text-xs font-medium text-slate-500">Body (HTML)</label>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={10}
                    className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(selected.id, "approve")}
                      disabled={processing === selected.id || !canSend}
                      className="flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
                    >
                      <Check className="h-4 w-4" /> Save & Send
                    </button>
                    <button
                      onClick={() => setEditMode(false)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium text-slate-500">
                    To: <span className="text-slate-700">{selected.sender_email ?? "—"}</span>
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selected.subject}</p>
                  <div
                    className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-800"
                    dangerouslySetInnerHTML={{ __html: selected.body_html }}
                  />
                  {!canSend && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      No recipient found for this draft — the customer email could not be resolved,
                      so it can&apos;t be sent.
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleAction(selected.id, "approve")}
                      disabled={processing === selected.id || !canSend}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                      {processing === selected.id ? "Sending…" : "Approve & Send"}
                    </button>
                    <button
                      onClick={() => {
                        setEditMode(true);
                        setEditSubject(selected.subject);
                        setEditBody(selected.body_html);
                      }}
                      disabled={processing === selected.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-40"
                    >
                      <Edit3 className="h-4 w-4" /> Edit
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt("Rejection reason (optional):");
                        handleAction(selected.id, "reject", reason ?? undefined);
                      }}
                      disabled={processing === selected.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      <X className="h-4 w-4" /> Reject
                    </button>
                  </div>
                </>
              )}
            </div>

            {cls?.explanation && (
              <div className="flex items-start gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {cls.explanation}
              </div>
            )}
          </div>
        )}
      </div>

      {!selected && !loading && (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-400">
          <Clock className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          Select a draft on the left to review the customer&apos;s query and the AI&apos;s reply.
        </div>
      )}
    </div>
  );
}
