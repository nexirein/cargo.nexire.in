"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Shield, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface PreflightCheck {
  check: string;
  status: "passed" | "warning" | "failed" | "pending";
  message: string;
  details?: string;
}

interface Props {
  batchRunId: string;
  totalItems: number;
}

export function AiPreflightPanel({ batchRunId, totalItems }: Props) {
  const router = useRouter();
  const [checks, setChecks] = useState<PreflightCheck[]>([
    { check: "clearance_types", status: "pending", message: "All items have clearance type resolved" },
    { check: "consignee_emails", status: "pending", message: "All items have recipient emails" },
    { check: "templates", status: "pending", message: "Templates are properly assigned" },
    { check: "duplicates", status: "pending", message: "No duplicate AWB numbers" },
  ]);
  const [running, setRunning] = useState(false);
  const [allPassed, setAllPassed] = useState(false);

  const runChecks = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/batches/${batchRunId}/preflight`);
      if (!res.ok) throw new Error("Preflight check failed");
      const data = await res.json();
      if (data.checks) {
        setChecks(data.checks);
        setAllPassed(data.checks.every((c: PreflightCheck) => c.status === "passed"));
      }
    } catch {
      setChecks((prev) =>
        prev.map((c) => ({
          ...c,
          status: "failed" as const,
          message: "Unable to connect",
        })),
      );
    } finally {
      setRunning(false);
    }
  }, [batchRunId]);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  const statusIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 animate-pulse rounded-full bg-slate-300" />;
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            AI Pre-flight Checks
          </h3>
          {allPassed ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              All passed
            </span>
          ) : null}
        </div>
        <button
          type="button"
          disabled={running}
          onClick={runChecks}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {running ? "Running..." : "Re-run checks"}
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        {checks.map((check) => (
          <div key={check.check} className="flex items-start gap-3 px-5 py-3">
            <div className="mt-0.5">{statusIcon(check.status)}</div>
            <div>
              <p className="text-sm font-medium text-slate-900">{check.message}</p>
              {check.details ? (
                <p className="mt-0.5 text-xs text-slate-500">{check.details}</p>
              ) : null}
              {check.status === "warning" && check.details ? (
                <p className="mt-0.5 text-xs text-amber-600">{check.details}</p>
              ) : null}
              {check.status === "failed" && check.details ? (
                <p className="mt-0.5 text-xs text-red-600">{check.details}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
