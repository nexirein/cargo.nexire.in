"use client";

import { useState, useEffect, useCallback } from "react";
import { Phone, RefreshCw } from "lucide-react";
import { CallDetailPanel, type CallData } from "./call-detail-panel";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "done", label: "Done" },
  { value: "skipped", label: "Skipped" },
];

const CALL_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "confirmation", label: "Confirmation" },
  { value: "broker_lookup", label: "Broker lookup" },
  { value: "reminder", label: "Reminder" },
  { value: "follow_up", label: "Follow-up" },
];

export default function CallsPage() {
  const [calls, setCalls] = useState<CallData[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [callType, setCallType] = useState("");

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (status) params.set("status", status);
      if (callType) params.set("call_type", callType);
      const res = await fetch(`/api/calls/enriched?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCalls(data ?? []);
    } catch (err) {
      console.error("Failed to load calls:", err);
    } finally {
      setLoading(false);
    }
  }, [status, callType]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const hasFilters = !!(status || callType);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calls</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI summaries, action items, and linked threads for every call
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={fetchCalls}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-3 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={callType}
          onChange={(e) => setCallType(e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-3 text-sm"
        >
          {CALL_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => { setStatus(""); setCallType(""); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        ) : null}
      </div>

      {loading && calls.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      ) : calls.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
          <Phone className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No call tasks</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Call tasks are created automatically for Calling-type shipments.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => (
            <CallDetailPanel key={call.id} call={call} />
          ))}
        </div>
      )}
    </div>
  );
}
