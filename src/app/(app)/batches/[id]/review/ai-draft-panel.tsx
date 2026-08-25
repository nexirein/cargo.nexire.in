"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileText, Check, X, RefreshCw, AlertCircle } from "lucide-react";

interface AiDraft {
  id: string;
  subject: string;
  body_html: string;
  body_text: string;
  confidence: number;
  status: string;
  trigger_type: string;
  trigger_reason: string | null;
  created_at: string;
  template_id: string | null;
  edited_subject?: string | null;
  edited_body?: string | null;
  rejection_reason?: string | null;
}

interface Props {
  batchId: string;
  initialDrafts: AiDraft[];
}

export function AiDraftPanel({ batchId, initialDrafts }: Props) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<AiDraft[]>(initialDrafts);
  const [generating, setGenerating] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<AiDraft | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");

  const handleAction = async (draftId: string, action: "approve" | "reject" | "edit", reason?: string) => {
    setProcessing(draftId);
    setMessage(null);
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

      setDrafts((prev) =>
        prev.map((d) =>
          d.id === draftId
            ? {
                ...d,
                status: action === "approve" ? "sent" : action === "reject" ? "rejected" : "edited",
                ...(editMode ? { edited_subject: editSubject, edited_body: editBody } : {}),
              }
            : d,
        ),
      );
      setMessage({ type: "success", text: `Draft ${action === "approve" ? "approved and sent" : action === "reject" ? "rejected" : "saved as edited"}` });
      setSelectedDraft(null);
      setEditMode(false);
      router.refresh();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Action failed" });
    } finally {
      setProcessing(null);
    }
  };

  const generateDrafts = useCallback(async () => {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/batches/${batchId}/generate-drafts`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      if (data.drafts) {
        setDrafts((prev) => {
          const existingIds = new Set(prev.map((d) => d.id));
          const newDrafts = data.drafts.filter((d: AiDraft) => !existingIds.has(d.id));
          return [...newDrafts, ...prev];
        });
      }
      setMessage({ type: "success", text: `Generated ${data.drafts?.length ?? 0} draft(s)` });
      router.refresh();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Generation failed" });
    } finally {
      setGenerating(false);
    }
  }, [batchId, router]);

  if (drafts.length === 0 && !generating) return null;

  const pendingDrafts = drafts.filter((d) => d.status === "pending");
  const approvedDrafts = drafts.filter((d) => d.status === "approved" || d.status === "sent");
  const rejectedDrafts = drafts.filter((d) => d.status === "rejected" || d.status === "edited");

  return (
    <div className="rounded-xl border border-indigo-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between border-b border-indigo-100 bg-indigo-50 px-5 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-indigo-800">
            AI Drafts — {drafts.length} total
            {pendingDrafts.length > 0 ? (
              <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {pendingDrafts.length} pending
              </span>
            ) : null}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={generating}
            onClick={(e) => { e.stopPropagation(); generateDrafts(); }}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${generating ? "animate-spin" : ""}`} />
            {generating ? "Generating..." : "Generate drafts"}
          </button>
          <span className="text-xs text-slate-400">{expanded ? "▼" : "▶"}</span>
        </div>
      </button>

      {message ? (
        <div className={`mx-5 mt-3 rounded-md px-3 py-2 text-xs ${
          message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        }`}>
          {message.text}
        </div>
      ) : null}

      {expanded && (
        <div className="divide-y divide-slate-100">
          {drafts.map((draft) => {
            const isEditing = selectedDraft?.id === draft.id && editMode;
            return (
              <div key={draft.id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{draft.subject}</span>
                    <DraftStatusBadge status={draft.status} />
                    {draft.confidence < 0.7 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        <AlertCircle className="h-3 w-3" /> Low confidence
                      </span>
                    ) : null}
                  </div>
                  {draft.status === "pending" && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={processing === draft.id}
                        onClick={() => handleAction(draft.id, "approve")}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Check className="mr-1 inline h-3 w-3" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDraft(draft);
                          setEditMode(true);
                          setEditSubject(draft.subject);
                          setEditBody(draft.body_text || draft.body_html.replace(/<[^>]*>/g, ""));
                        }}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit & Approve
                      </button>
                      <button
                        type="button"
                        disabled={processing === draft.id}
                        onClick={() => handleAction(draft.id, "reject")}
                        className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <X className="mr-1 inline h-3 w-3" /> Reject
                      </button>
                    </div>
                  )}
                  {draft.status === "edited" && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={processing === draft.id}
                        onClick={() => handleAction(draft.id, "approve")}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Check className="mr-1 inline h-3 w-3" /> Approve & Send
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-slate-400">
                  {draft.body_text?.slice(0, 120) ?? ""}
                </p>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                  <span>Confidence: {(draft.confidence * 100).toFixed(0)}%</span>
                  <span>Type: {draft.trigger_type}</span>
                  <span>{new Date(draft.created_at).toLocaleDateString()}</span>
                </div>
                {draft.status === "sent" && draft.edited_subject && (
                  <p className="mt-1 text-xs text-slate-500">
                    Edited version sent: {draft.edited_subject}
                  </p>
                )}
                {draft.status === "rejected" && draft.rejection_reason && (
                  <p className="mt-1 text-xs text-red-500">
                    Reason: {draft.rejection_reason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedDraft && editMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="mx-4 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Edit Draft</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500">Subject</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Body</label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={12}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setSelectedDraft(null); setEditMode(false); }}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch("/api/ai/drafts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      draftId: selectedDraft.id,
                      action: "edit",
                      editedSubject: editSubject,
                      editedBody: editBody,
                    }),
                  });
                  if (res.ok) {
                    setMessage({ type: "success", text: "Draft saved as edited" });
                    setDrafts((prev) =>
                      prev.map((d) =>
                        d.id === selectedDraft.id ? { ...d, status: "edited" } : d,
                      ),
                    );
                    setSelectedDraft(null);
                    setEditMode(false);
                    router.refresh();
                  }
                }}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Save edits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DraftStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
    approved: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Approved" },
    edited: { bg: "bg-blue-100", text: "text-blue-700", label: "Edited" },
    rejected: { bg: "bg-red-100", text: "text-red-700", label: "Rejected" },
    sent: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Sent" },
  };
  const style = styles[status];
  if (!style) return null;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}
