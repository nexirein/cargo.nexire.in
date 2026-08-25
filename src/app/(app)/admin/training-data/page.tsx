"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Database,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  AlertCircle,
  ThumbsUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const CLEARANCE_TYPES = ["nfbrk", "febrk", "febrk-sunimpex", "febrk-jeena", "calling", "hold"] as const;
const INTENTS = ["inquiry", "update", "escalation", "confirmation", "docs_request", "other"] as const;
const URGENCIES = ["low", "normal", "high", "critical"] as const;

interface EmailRecord {
  id: string;
  awb: string | null;
  subject: string | null;
  body_clean: string | null;
  sender_email: string | null;
  clearance_type: string | null;
  intent: string | null;
  urgency: string | null;
  created_at: string;
}

export default function TrainingDataPage() {
  const supabase = createClient();
  const [records, setRecords] = useState<EmailRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [filter, setFilter] = useState<"all" | "unlabeled" | "low_confidence">("unlabeled");

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("emails")
      .select("id, awb, subject, body_clean, sender_email, clearance_type, intent, urgency, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter === "unlabeled") {
      query = query.is("intent", null);
    }

    const { data, error } = await query;

    if (error) {
      setMessage({ type: "error", text: `Failed to load: ${error.message}` });
      setRecords([]);
    } else {
      setRecords(data ?? []);
      setCurrentIndex(0);
    }
    setLoading(false);
  }, [supabase, filter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const currentRecord = records[currentIndex];

  const saveCorrection = async (field: string, correctedValue: string) => {
    if (!currentRecord) return;
    setSaving(field);

    try {
      const predictedValue = currentRecord[field as keyof EmailRecord] as string | null;

      const { error: logError } = await supabase.from("correction_log").insert({
        email_event_id: currentRecord.id,
        field_name: field,
        predicted_value: predictedValue,
        corrected_value: correctedValue,
        source_context: "training_data_admin",
      });

      if (logError) throw logError;

      const updateField = field === "clearance_type" ? "clearance_type" : field;
      const { error: updateError } = await supabase
        .from("emails")
        .update({ [updateField]: correctedValue })
        .eq("id", currentRecord.id);

      if (updateError) throw updateError;

      setRecords((prev) =>
        prev.map((r) =>
          r.id === currentRecord.id ? { ...r, [field]: correctedValue } : r
        )
      );

      setMessage({ type: "success", text: `${field} saved as "${correctedValue}"` });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Save failed",
      });
    }

    setSaving(null);
  };

  const skipRecord = () => {
    if (currentIndex < records.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Training Data</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and correct AI labels to improve classifier accuracy
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="unlabeled">Unlabeled only</option>
            <option value="all">All records</option>
          </select>
          <Database className="h-5 w-5 text-indigo-500" />
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.type === "success" ? (
            <ThumbsUp className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <Database className="h-12 w-12 text-slate-300 mb-4" />
          <h2 className="text-lg font-medium text-slate-700">No records to review</h2>
          <p className="text-sm text-slate-500 mt-1">
            {filter === "unlabeled"
              ? "All records have been labeled. Switch to 'All records' to review existing labels."
              : "No email records found in the database. Run the embedding pipeline first."}
          </p>
        </div>
      ) : currentRecord ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Record {currentIndex + 1} of {records.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentIndex((i) => Math.min(records.length - 1, i + 1))}
                disabled={currentIndex === records.length - 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">AWB:</span>{" "}
                <span className="font-mono">{currentRecord.awb || "—"}</span>
              </div>
              <div>
                <span className="text-slate-500">Sender:</span>{" "}
                {currentRecord.sender_email || "—"}
              </div>
            </div>

            <div>
              <span className="text-sm text-slate-500">Subject:</span>
              <p className="text-sm font-medium mt-0.5">
                {currentRecord.subject || "—"}
              </p>
            </div>

            <div>
              <span className="text-sm text-slate-500">Body:</span>
              <pre className="mt-1 text-xs bg-slate-50 rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">
                {currentRecord.body_clean?.slice(0, 2000) || "—"}
              </pre>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-sm font-medium text-slate-700 mb-3">
                Labels
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <LabelField
                  name="clearance_type"
                  value={currentRecord.clearance_type}
                  options={CLEARANCE_TYPES}
                  saving={saving}
                  onSave={saveCorrection}
                />
                <LabelField
                  name="intent"
                  value={currentRecord.intent}
                  options={INTENTS}
                  saving={saving}
                  onSave={saveCorrection}
                />
                <LabelField
                  name="urgency"
                  value={currentRecord.urgency}
                  options={URGENCIES}
                  saving={saving}
                  onSave={saveCorrection}
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-3 bg-slate-50 rounded-b-xl border-t border-slate-100 flex justify-between">
            <button
              onClick={skipRecord}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Skip →
            </button>
            <span className="text-xs text-slate-400">
              {records.length - currentIndex - 1} remaining
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LabelField({
  name,
  value,
  options,
  saving,
  onSave,
}: {
  name: string;
  value: string | null;
  options: readonly string[];
  saving: string | null;
  onSave: (field: string, value: string) => Promise<void>;
}) {
  const isSaving = saving === name;

  return (
    <div>
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
        {name.replace(/_/g, " ")}
      </label>
      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onSave(name, opt)}
            disabled={isSaving}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
              value === opt
                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
            } ${isSaving ? "opacity-50 cursor-wait" : ""}`}
          >
            {isSaving ? "..." : value === opt ? <Check className="h-3 w-3 inline mr-0.5" /> : null}
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
