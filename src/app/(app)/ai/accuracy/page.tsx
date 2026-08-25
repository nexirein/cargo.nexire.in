"use client";

import { useState, useEffect, useCallback } from "react";
import { Bot, BarChart3, RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, FileText, Bell } from "lucide-react";

interface MetricsData {
  totals: {
    totalClassifications: number;
    todayClassifications: number;
    totalCorrections: number;
    newCorrections: number;
  };
  routes: Record<string, number>;
  clearanceTypes: Record<string, number>;
  accuracy: {
    overall: number;
    correctCount: number;
    totalInference: number;
    avgLatencyMs: number;
  };
  confusionMatrix: Record<string, Record<string, number>>;
  dailyAccuracy: { date: string; total: number; correct: number; accuracy: number }[];
  dailyVolume: { date: string; count: number }[];
  drafts: { pending: number; approved: number; rejected: number };
  followups: { pending: number; sent: number };
  config: Record<string, unknown>;
}

interface RetrainData {
  jobs: {
    id: string;
    status: string;
    correction_count: number;
    classifier_version: string;
    prev_classifier_version: string;
    accuracy_before: number;
    accuracy_after: number;
    error_message: string | null;
    started_at: string;
    completed_at: string;
    created_at: string;
  }[];
  activeJob: { id: string; started_at: string } | null;
  pendingCorrections: number;
  newCorrectionsSinceLastRetrain: number;
  canRetrain: boolean;
}

const ROUTE_LABELS: Record<string, string> = {
  ai_auto_send: "AI Auto-Send",
  ai_draft_hold: "AI Draft Hold",
  human_review: "Human Review",
  ignore: "Ignore",
};

const ROUTE_COLORS: Record<string, string> = {
  ai_auto_send: "bg-emerald-500",
  ai_draft_hold: "bg-amber-500",
  human_review: "bg-red-500",
  ignore: "bg-slate-400",
};

export default function AiAccuracyPage() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [retrain, setRetrain] = useState<RetrainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsRes, retrainRes] = await Promise.all([
        fetch("/api/ai/metrics"),
        fetch("/api/ai/retrain"),
      ]);
      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (retrainRes.ok) setRetrain(await retrainRes.json());
    } catch {
      setMessage({ type: "error", text: "Failed to load AI metrics" });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const triggerRetrain = async () => {
    setRetraining(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ai/retrain", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Retrain failed");
      }
      setMessage({ type: "success", text: "Retraining completed successfully" });
      fetchData();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Retrain failed" });
    } finally {
      setRetraining(false);
    }
  };

  if (loading && !metrics) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  const m = metrics;
  const confMatrixKeys = m?.confusionMatrix ? Object.keys(m.confusionMatrix) : [];
  const allLabels = [...new Set([
    ...confMatrixKeys,
    ...Object.values(m?.confusionMatrix ?? {}).flatMap(Object.keys),
  ])];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-slate-600" />
          <h1 className="text-2xl font-semibold text-slate-900">AI Accuracy & Monitoring</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {retrain?.canRetrain ? (
            <button
              type="button"
              disabled={retraining}
              onClick={triggerRetrain}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {retraining ? "Retraining..." : `Retrain (${retrain.newCorrectionsSinceLastRetrain} corrections)`}
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <div className={`mt-4 rounded-md px-4 py-3 text-sm ${
          message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        }`}>
          {message.text}
        </div>
      ) : null}

      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Total classifications"
          value={m?.totals.totalClassifications ?? 0}
          sub={`${m?.totals.todayClassifications ?? 0} today`}
        />
        <SummaryCard
          icon={m && m.accuracy.overall >= 80 ? <CheckCircle className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
          label="Classifier accuracy"
          value={`${m?.accuracy.overall ?? 0}%`}
          sub={`${m?.accuracy.correctCount ?? 0}/${m?.accuracy.totalInference ?? 0} correct`}
          highlight={m ? m.accuracy.overall >= 80 ? "emerald" : m.accuracy.overall >= 60 ? "amber" : "red" : undefined}
        />
        <SummaryCard
          icon={<Clock className="h-5 w-5" />}
          label="Avg latency"
          value={`${m?.accuracy.avgLatencyMs ?? 0}ms`}
        />
        <SummaryCard
          icon={<XCircle className="h-5 w-5 text-red-400" />}
          label="Corrections"
          value={m?.totals.totalCorrections ?? 0}
          sub={`${m?.totals.newCorrections ?? 0} new (7d)`}
        />
      </div>

      {/* AI Pipeline Status */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-medium text-slate-500">AI Enabled</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {String(m?.config?.ai_enabled ?? "true")}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-medium text-slate-500">AI Drafts</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {m?.drafts.pending ?? 0} pending
          </p>
          <p className="text-xs text-slate-400">
            {m?.drafts.approved ?? 0} approved · {m?.drafts.rejected ?? 0} rejected
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium text-slate-500">Follow-ups</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {m?.followups.pending ?? 0} pending
          </p>
          <p className="text-xs text-slate-400">
            {m?.followups.sent ?? 0} sent
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-violet-500" />
            <span className="text-xs font-medium text-slate-500">Classifier</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {String(m?.config?.classifier_version ?? "—")}
          </p>
          <p className="text-xs text-slate-400">
            {m?.config?.auto_send_enabled ? "Auto-send on" : "Auto-send off"}
          </p>
        </div>
      </div>

      {/* Route Distribution */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Route Distribution</h3>
          {m?.routes && Object.keys(m.routes).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(m.routes)
                .sort(([, a], [, b]) => b - a)
                .map(([route, count]) => {
                  const total = Object.values(m.routes).reduce((s, c) => s + c, 0);
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={route} className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${ROUTE_COLORS[route] ?? "bg-slate-400"}`} />
                      <span className="w-28 text-xs text-slate-600">{ROUTE_LABELS[route] ?? route}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${ROUTE_COLORS[route] ?? "bg-slate-400"} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs font-semibold text-slate-900">{pct}%</span>
                      <span className="w-10 text-right text-xs text-slate-400">{count}</span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No classification data yet</p>
          )}
        </div>

        {/* Clearance Type Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Clearance Type Distribution</h3>
          {m?.clearanceTypes && Object.keys(m.clearanceTypes).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(m.clearanceTypes)
                .sort(([, a], [, b]) => b - a)
                .map(([ct, count]) => {
                  const total = Object.values(m.clearanceTypes).reduce((s, c) => s + c, 0);
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={ct} className="flex items-center gap-3">
                      <span className="w-24 text-xs text-slate-600">{ct}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs font-semibold text-slate-900">{pct}%</span>
                      <span className="w-10 text-right text-xs text-slate-400">{count}</span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No clearance data yet</p>
          )}
        </div>
      </div>

      {/* Confusion Matrix */}
      {confMatrixKeys.length > 0 && allLabels.length > 0 && (
        <div className="mt-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Confusion Matrix</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left text-slate-500">Predicted → Actual</th>
                    {allLabels.map((l) => (
                      <th key={l} className="px-3 py-1 text-right font-medium text-slate-600">{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {confMatrixKeys.map((pred) => (
                    <tr key={pred}>
                      <td className="px-2 py-1 font-medium text-slate-700">{pred}</td>
                      {allLabels.map((actual) => {
                        const val = m?.confusionMatrix[pred]?.[actual] ?? 0;
                        const maxInRow = Math.max(
                          ...allLabels.map((l) => m?.confusionMatrix[pred]?.[l] ?? 0),
                          1,
                        );
                        const intensity = val > 0 ? Math.round((val / maxInRow) * 100) : 0;
                        const isDiagonal = pred === actual;
                        return (
                          <td
                            key={actual}
                            className={`px-3 py-1 text-right font-medium ${
                              isDiagonal && val > 0 ? "text-emerald-700" : val > 0 ? "text-amber-700" : "text-slate-400"
                            }`}
                            style={{
                              backgroundColor: isDiagonal
                                ? `rgba(16, 185, 129, ${intensity / 100 * 0.3})`
                                : val > 0
                                  ? `rgba(245, 158, 11, ${intensity / 100 * 0.2})`
                                  : undefined,
                            }}
                          >
                            {val > 0 ? val : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Retraining History */}
      {retrain?.jobs && retrain.jobs.length > 0 && (
        <div className="mt-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Retraining History</h3>
            <div className="space-y-2">
              {retrain.jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between rounded-md bg-slate-50 px-4 py-2">
                  <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full ${
                      job.status === "completed" ? "bg-emerald-500" :
                      job.status === "failed" ? "bg-red-500" :
                      job.status === "processing" ? "bg-amber-500 animate-pulse" :
                      "bg-slate-300"
                    }`} />
                    <div>
                      <p className="text-xs font-medium text-slate-900">
                        {job.prev_classifier_version} → {job.classifier_version}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(job.created_at).toLocaleDateString()} · {job.correction_count} corrections
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-slate-600">
                      {job.accuracy_before != null ? `${job.accuracy_before}%` : "—"} → {job.accuracy_after != null ? `${job.accuracy_after}%` : "—"}
                    </p>
                    {job.error_message && (
                      <p className="text-red-500">{job.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Daily Accuracy Trend */}
      {m?.dailyAccuracy && m.dailyAccuracy.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Daily Accuracy (30d)</h3>
            <div className="flex items-end gap-1 h-32">
              {m.dailyAccuracy.map((d) => {
                const maxAcc = Math.max(...m.dailyAccuracy.map((x) => x.accuracy), 1);
                const height = (d.accuracy / maxAcc) * 100;
                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center gap-1"
                    title={`${d.date}: ${d.accuracy}% (${d.correct}/${d.total})`}
                  >
                    <div
                      className={`w-full rounded-t ${
                        d.accuracy >= 80 ? "bg-emerald-400" :
                        d.accuracy >= 60 ? "bg-amber-400" :
                        "bg-red-400"
                      }`}
                      style={{ height: `${height}%`, minHeight: 4 }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Daily Volume (30d)</h3>
            <div className="flex items-end gap-1 h-32">
              {m.dailyVolume.map((d) => {
                const maxCount = Math.max(...m.dailyVolume.map((x) => x.count), 1);
                const height = (d.count / maxCount) * 100;
                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center gap-1"
                    title={`${d.date}: ${d.count} classifications`}
                  >
                    <div
                      className="w-full rounded-t bg-indigo-400"
                      style={{ height: `${height}%`, minHeight: 4 }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  highlight?: "emerald" | "amber" | "red";
}) {
  const valueColors = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-red-700",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${highlight ? valueColors[highlight] : "text-slate-900"}`}>
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}
