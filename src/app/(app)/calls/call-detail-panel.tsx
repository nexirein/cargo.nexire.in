"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, FileText, ExternalLink, Clock, AlertTriangle } from "lucide-react";

interface ActionItem {
  action: string;
  scheduledHours: number;
  priority: "low" | "normal" | "high";
}

interface ThreadLink {
  caseId: string;
  awb: string;
  subject: string;
  matchType: string;
  matchConfidence: number;
  emailCount: number;
  lastActiveAt: string;
}

interface CallSummary {
  company: string;
  contact: string;
  purpose: string;
  keyPoints: string[];
  followUp: string;
  actionItems: { action: string; scheduledFor: string; priority: string }[];
  urgency: string;
}

interface CallData {
  id: string;
  awb: string;
  consignee_name: string | null;
  call_type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  notes: string | null;
  vapi_transcript: string | null;
  vapi_summary: string | null;
  call_summary: CallSummary | null;
  action_items: ActionItem[] | null;
  thread_links: ThreadLink[] | null;
  ai_summary_status: string;
  case_id: string | null;
  batch_item_id: string | null;
}

export type { CallData };
export function CallDetailPanel({ call }: { call: CallData }) {
  const [expanded, setExpanded] = useState(false);

  const hasSummary = call.call_summary && call.ai_summary_status === "completed";
  const hasActions = call.action_items && call.action_items.length > 0;
  const hasThreads = call.thread_links && call.thread_links.length > 0;
  const hasTranscript = call.vapi_transcript || call.vapi_summary;
  const hasAiProcessing = call.ai_summary_status !== "pending";

  const urgencyColors: Record<string, string> = {
    low: "bg-slate-100 text-slate-600",
    normal: "bg-blue-100 text-blue-700",
    high: "bg-amber-100 text-amber-700",
    critical: "bg-red-100 text-red-700",
  };

  const priorityColors: Record<string, string> = {
    low: "text-slate-500",
    normal: "text-amber-600",
    high: "text-red-600",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-slate-900">{call.awb}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {call.call_type}
              </span>
              {call.call_summary?.urgency && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${urgencyColors[call.call_summary.urgency] ?? "bg-slate-100 text-slate-600"}`}>
                  {call.call_summary.urgency}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {call.consignee_name ?? "Unknown"} · {new Date(call.created_at).toLocaleString("en-IN")}
              {call.completed_at ? ` · Completed ${new Date(call.completed_at).toLocaleString("en-IN")}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {call.ai_summary_status === "processing" && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 animate-pulse">
              Summarizing...
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            call.status === "done" || call.status === "completed"
              ? "bg-emerald-100 text-emerald-700"
              : call.status === "pending"
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-500"
          }`}>
            {call.status}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {/* AI Summary */}
          {hasAiProcessing && (
            <div className="border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-500" />
                <h4 className="text-sm font-semibold text-slate-900">AI Summary</h4>
                {call.ai_summary_status === "failed" && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    Failed
                  </span>
                )}
              </div>
              {hasSummary ? (
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-medium text-slate-500">Company:</span>
                      <p className="text-slate-900">{call.call_summary?.company ?? "—"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-slate-500">Contact:</span>
                      <p className="text-slate-900">{call.call_summary?.contact ?? "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium text-slate-500">Purpose:</span>
                      <p className="text-slate-900">{call.call_summary?.purpose ?? "—"}</p>
                    </div>
                  </div>
                  {call.call_summary?.keyPoints && call.call_summary.keyPoints.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-slate-500">Key Points:</span>
                      <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-slate-700">
                        {call.call_summary.keyPoints.map((kp: string, i: number) => (
                          <li key={i}>{kp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {call.call_summary?.followUp && (
                    <div>
                      <span className="text-xs font-medium text-slate-500">Follow-up:</span>
                      <p className="text-xs text-slate-700">{call.call_summary.followUp}</p>
                    </div>
                  )}
                </div>
              ) : !hasSummary && call.ai_summary_status === "completed" ? (
                <p className="mt-1 text-xs text-slate-400">No structured summary available</p>
              ) : null}
            </div>
          )}

          {/* Action Items */}
          {hasActions && (
            <div className="border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <h4 className="text-sm font-semibold text-slate-900">Action Items</h4>
              </div>
              <div className="mt-2 space-y-2">
                {call.action_items?.map((item: ActionItem, i: number) => (
                  <div key={i} className="flex items-start gap-2 rounded-md bg-amber-50/50 px-3 py-2">
                    <AlertTriangle className={`mt-0.5 h-3 w-3 flex-shrink-0 ${priorityColors[item.priority] ?? "text-slate-400"}`} />
                    <div>
                      <p className="text-xs font-medium text-slate-900">{item.action}</p>
                      <p className="text-xs text-slate-500">
                        Due in ~{item.scheduledHours}h · Priority: {item.priority}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Thread Links */}
          {hasThreads && (
            <div className="border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-blue-500" />
                <h4 className="text-sm font-semibold text-slate-900">Linked Threads</h4>
              </div>
              <div className="mt-2 space-y-1">
                {call.thread_links?.map((thread: ThreadLink, i: number) => (
                  <Link
                    key={i}
                    href={`/cases/${thread.caseId}`}
                    className="flex items-center justify-between rounded-md bg-blue-50/50 px-3 py-2 text-xs transition hover:bg-blue-100/50"
                  >
                    <div>
                      <span className="font-medium text-slate-900">{thread.subject}</span>
                      <span className="ml-2 text-slate-500">({thread.matchType})</span>
                    </div>
                    <span className="flex items-center gap-1 text-blue-600">
                      View <ExternalLink className="h-3 w-3" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Transcript */}
          {hasTranscript && (
            <div className="border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <h4 className="text-sm font-semibold text-slate-900">Transcript</h4>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-600">
                  {call.vapi_summary ? "Show summary" : "Show transcript"}
                </summary>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap font-mono">
                  {call.vapi_summary ?? call.vapi_transcript ?? "No transcript available"}
                </div>
              </details>
            </div>
          )}

          {/* Notes */}
          {call.notes && (
            <div className="px-5 py-3">
              <p className="text-xs text-slate-500">Notes:</p>
              <p className="mt-0.5 text-xs text-slate-700">{call.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
