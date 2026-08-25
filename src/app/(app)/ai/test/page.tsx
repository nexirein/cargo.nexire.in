"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FlaskConical,
  Send,
  ScanSearch,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Link as LinkIcon,
} from "lucide-react";
import Link from "next/link";

type Route = "ignore" | "ai_auto_send" | "ai_draft_hold" | "human_review";

interface ClassifyResult {
  clearanceType: string;
  intent: string;
  urgency: string;
  responseType: string;
  route: Route;
  confidence: number;
  humanReviewRequired: boolean;
  explanation: string;
  latencyMs: number;
  classifierVersion: string;
  stageOutputs: {
    rule: { matches: { name: string; confidence: number }[] } | null;
    ml: {
      clearanceType?: string;
      intent?: string;
      confidence: number;
      probabilities?: Record<string, number>;
    } | null;
    llm: {
      clearanceType?: string;
      intent?: string;
      urgency?: string;
      responseType?: string;
      reasoning?: string;
      flags?: string[];
    } | null;
  };
}

interface IngestResult {
  status: string;
  emailEventId: string | null;
  caseId: string | null;
  classification?: ClassifyResult;
  draftCreated?: boolean;
}

interface SampleAwb {
  awb: string;
  consignee_name: string | null;
  consignee_email: string | null;
  clearance_type: string | null;
}

interface Scenario {
  id: string;
  label: string;
  group: string;
  expected: Route | "no_case";
  expectedLabel: string;
  note: string;
  subject: string;
  body: string;
  from: string;
  useAwb: boolean;
}

const ROUTE_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  ai_auto_send: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  ai_draft_hold: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  human_review: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  ignore: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
  no_case: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
};

const ROUTE_LABEL: Record<string, string> = {
  ai_auto_send: "Auto-sent by AI",
  ai_draft_hold: "Draft for review",
  human_review: "Human review",
  ignore: "Ignored",
  no_case: "No case created",
};

const SCENARIOS: Scenario[] = [
  {
    id: "shipment_info",
    label: "Shipment info request",
    group: "Routine (auto-send)",
    expected: "ai_auto_send",
    expectedLabel: "Auto-send",
    note: "Generic 'more info about this shipment' query. Routine pattern, low urgency.",
    subject: "Need more info about this shipment",
    body: "Hello, we are importing this shipment under NFBRK. Can you please share the current status and arrival details of this shipment?",
    from: "test-consignee@example.com",
    useAwb: true,
  },
  {
    id: "igm_query",
    label: "IGM query",
    group: "Routine (auto-send)",
    expected: "ai_auto_send",
    expectedLabel: "Auto-send",
    note: "IGM / bill of lading details request.",
    subject: "IGM details",
    body: "Please share the IGM number and bill of lading details for this shipment.",
    from: "test-consignee@example.com",
    useAwb: true,
  },
  {
    id: "do_query",
    label: "DO / DO charges",
    group: "Routine (auto-send)",
    expected: "ai_auto_send",
    expectedLabel: "Auto-send",
    note: "Delivery order availability + charges query.",
    subject: "Delivery order",
    body: "When will the delivery order be ready? What are the DO collection charges?",
    from: "test-consignee@example.com",
    useAwb: true,
  },
  {
    id: "confirmation",
    label: "Confirmation / ack",
    group: "Routine (auto-send)",
    expected: "ai_auto_send",
    expectedLabel: "Auto-send",
    note: "Simple acknowledgement — safe to confirm.",
    subject: "Received, thanks",
    body: "Thanks, we received the pre-alert. We will share the documents today.",
    from: "test-consignee@example.com",
    useAwb: true,
  },
  {
    id: "docs_request",
    label: "Documents request",
    group: "Needs human",
    expected: "ai_draft_hold",
    expectedLabel: "Draft hold",
    note: "request_docs is not routine, strict 0.97 auto-send not met → draft for review.",
    subject: "Request documents",
    body: "Please send us the commercial invoice and packing list for this shipment.",
    from: "test-consignee@example.com",
    useAwb: true,
  },
  {
    id: "penalty",
    label: "Penalty question",
    group: "Needs human",
    expected: "ai_draft_hold",
    expectedLabel: "Draft hold",
    note: "High-urgency question — escalated to human.",
    subject: "Penalty question",
    body: "What is the penalty if we do not file the BOE within the prescribed time?",
    from: "test-consignee@example.com",
    useAwb: true,
  },
  {
    id: "urgent",
    label: "Urgent request",
    group: "Needs human",
    expected: "ai_draft_hold",
    expectedLabel: "Draft hold",
    note: "Critical urgency blocks auto-send.",
    subject: "URGENT - need this today",
    body: "URGENT - need the shipment details immediately, it is on a tight deadline.",
    from: "test-consignee@example.com",
    useAwb: true,
  },
  {
    id: "escalation",
    label: "Escalation / complaint",
    group: "Needs human",
    expected: "ai_draft_hold",
    expectedLabel: "Draft hold",
    note: "Escalation intent, high urgency → never auto-sends.",
    subject: "Escalation",
    body: "I am not happy with the service. I want to escalate this to your supervisor.",
    from: "test-consignee@example.com",
    useAwb: true,
  },
  {
    id: "legal",
    label: "Legal keyword",
    group: "Needs human",
    expected: "ai_draft_hold",
    expectedLabel: "Draft hold",
    note: "Legal keywords (attorney/regulatory) always block auto-send.",
    subject: "Legal review",
    body: "Our attorney is reviewing this shipment. Please share the regulatory status.",
    from: "test-consignee@example.com",
    useAwb: true,
  },
  {
    id: "vip",
    label: "VIP sender",
    group: "Needs human",
    expected: "ai_draft_hold",
    expectedLabel: "Draft hold",
    note: "Only blocks if the sender matches app_config vip_senders (set this in DB to test).",
    subject: "Shipment status",
    body: "Please share the current shipment status.",
    from: "vip@example-corp.com",
    useAwb: true,
  },
  {
    id: "ooo",
    label: "Out of office",
    group: "Machine / noise",
    expected: "ai_draft_hold",
    expectedLabel: "Draft hold",
    note: "no_action type — currently held as a draft for review, not ignored. If you want these dropped, that's a follow-up change.",
    subject: "Out of office",
    body: "I am out of office until Monday and will reply when I return.",
    from: "someone-away@example.com",
    useAwb: false,
  },
  {
    id: "bounce",
    label: "Bounce / delivery failure",
    group: "Machine / noise",
    expected: "ai_draft_hold",
    expectedLabel: "Draft hold",
    note: "Delivery status notification — same behaviour as OOO.",
    subject: "Delivery Status Notification (Failure)",
    body: "Your message could not be delivered to the following recipients. Mailbox unavailable.",
    from: "postmaster@example.com",
    useAwb: false,
  },
  {
    id: "gibberish",
    label: "Low confidence / gibberish",
    group: "Edge cases",
    expected: "human_review",
    expectedLabel: "Human review",
    note: "No rule match, low ensemble confidence → human review.",
    subject: "zzz",
    body: "asdf qwerty lorem ipsum 12345 xyzzy nothing meaningful here",
    from: "unknown@example.com",
    useAwb: true,
  },
  {
    id: "no_awb",
    label: "No AWB in message",
    group: "Edge cases",
    expected: "no_case",
    expectedLabel: "No case created",
    note: "Ingested into email_events but no AWB → no case, no classification, no reply.",
    subject: "General question",
    body: "Hi, I wanted to know about your clearance process in general. Do you handle FEBRK shipments?",
    from: "prospect@example.com",
    useAwb: false,
  },
];

export default function AiTestPage() {
  const [selectedId, setSelectedId] = useState<string>(SCENARIOS[0].id);
  const [subject, setSubject] = useState(SCENARIOS[0].subject);
  const [body, setBody] = useState(SCENARIOS[0].body);
  const [from, setFrom] = useState(SCENARIOS[0].from);
  const [awb, setAwb] = useState("");
  const [sampleAwbs, setSampleAwbs] = useState<SampleAwb[]>([]);
  const [awbLoading, setAwbLoading] = useState(true);

  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [busy, setBusy] = useState<"classify" | "ingest" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSampleAwbs = useCallback(async () => {
    setAwbLoading(true);
    try {
      const res = await fetch("/api/inbox/sample-awbs");
      const data = await res.json();
      if (data?.ok && data.awbs?.length > 0) {
        setSampleAwbs(data.awbs);
        setAwb((prev) => prev || data.awbs[0].awb);
      }
    } catch {
      /* sample list is optional */
    }
    setAwbLoading(false);
  }, []);

  useEffect(() => {
    fetchSampleAwbs();
  }, [fetchSampleAwbs]);

  const selected = SCENARIOS.find((s) => s.id === selectedId) ?? SCENARIOS[0];

  function applyScenario(id: string) {
    const sc = SCENARIOS.find((s) => s.id === id);
    if (!sc) return;
    setSelectedId(id);
    setSubject(sc.subject);
    setBody(sc.body);
    setFrom(sc.from);
    setError(null);
    setClassifyResult(null);
    setIngestResult(null);
    if (!sc.useAwb) {
      setAwb("");
    } else if (!awb && sampleAwbs.length > 0) {
      setAwb(sampleAwbs[0].awb);
    }
  }

  function bodyWithAwb(): string {
    if (!awb || body.toLowerCase().includes(awb.toLowerCase())) return body;
    return `${body}\n\nAWB Reference: ${awb}`;
  }

  async function runClassify() {
    setBusy("classify");
    setError(null);
    setClassifyResult(null);
    setIngestResult(null);
    try {
      const res = await fetch("/api/ai/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body: bodyWithAwb(),
          sender: from,
          awb: awb || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Classification failed");
      setClassifyResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Classification failed");
    }
    setBusy(null);
  }

  async function runPipeline() {
    setBusy("ingest");
    setError(null);
    setClassifyResult(null);
    setIngestResult(null);
    try {
      const res = await fetch("/api/inbox/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: `test-${crypto.randomUUID()}`,
          subject,
          from,
          to: [],
          cc: [],
          textBody: bodyWithAwb(),
          receivedAt: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Pipeline failed");
      setIngestResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pipeline failed");
    }
    setBusy(null);
  }

  const resultRoute: Route | "no_case" | null = ingestResult
    ? ingestResult.caseId === null
      ? "no_case"
      : (ingestResult.classification?.route ?? null)
    : classifyResult?.route ?? null;

  const expectedNotApplicable =
    selected.expected === "no_case" && !ingestResult;

  const matchesExpected = expectedNotApplicable
    ? null
    : resultRoute === selected.expected;

  const routeStyle = resultRoute ? ROUTE_STYLE[resultRoute] : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <FlaskConical className="h-6 w-6 text-indigo-500" />
          Test the AI Reply Pipeline
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Try real customer scenarios through the classifier and the full
          ingest pipeline (which sends the email). Use the buttons to switch
          between a dry-run classification and the actual pipeline.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: scenario + payload */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Pick a scenario
            </h2>
            {(["Routine (auto-send)", "Needs human", "Machine / noise", "Edge cases"] as const).map(
              (group) => (
                <div key={group} className="mb-3">
                  <p className="mb-1.5 text-xs font-medium text-slate-400">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {SCENARIOS.filter((s) => s.group === group).map((sc) => (
                      <button
                        key={sc.id}
                        onClick={() => applyScenario(sc.id)}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                          selectedId === sc.id
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                </div>
              ),
            )}
            <p className="mt-1 text-xs text-slate-400">
              Expected: <span className="font-medium">{selected.expectedLabel}</span> — {selected.note}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Email payload
            </h2>
            <label className="mb-1 block text-xs font-medium text-slate-500">From</label>
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="consignee@example.com"
            />
            <label className="mb-1 block text-xs font-medium text-slate-500">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <label className="mb-1 block text-xs font-medium text-slate-500">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <label className="mb-1 block text-xs font-medium text-slate-500">
              AWB <span className="text-slate-400">(sample from a real batch — gives the AI grounded facts)</span>
            </label>
            <select
              value={awb}
              onChange={(e) => setAwb(e.target.value)}
              disabled={awbLoading}
              className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">— none —</option>
              {sampleAwbs.map((s) => (
                <option key={s.awb} value={s.awb}>
                  {s.awb}
                  {s.consignee_name ? ` · ${s.consignee_name}` : ""}
                  {s.clearance_type ? ` · ${s.clearance_type}` : ""}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={runClassify}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                <ScanSearch className="h-4 w-4" />
                {busy === "classify" ? "Classifying…" : "Preview classification (no send)"}
              </button>
              <button
                onClick={runPipeline}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {busy === "ingest" ? "Running pipeline…" : "Run full pipeline (sends email)"}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              The full pipeline actually sends an SMTP reply to the From address on{" "}
              <span className="font-medium">ai_auto_send</span>. Use your own email to receive it.
            </p>
          </div>
        </div>

        {/* Right: results */}
        <div className="space-y-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {busy !== null && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {busy === "classify" ? "Running rule + ML + LLM ensemble…" : "Ingesting, classifying, drafting, sending…"}
            </div>
          )}

          {!busy && !classifyResult && !ingestResult && !error && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-400">
              Pick a scenario and run one of the two actions. The result will
              appear here.
            </div>
          )}

          {resultRoute && routeStyle && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${routeStyle.bg} ${routeStyle.text}`}
                >
                  <span className={`h-2 w-2 rounded-full ${routeStyle.dot}`} />
                  {ROUTE_LABEL[resultRoute]}
                </span>
                {ingestResult && (
                  <span className="text-xs text-slate-400">
                    {ingestResult.status}
                    {ingestResult.draftCreated ? " · draft created" : ""}
                  </span>
                )}
              </div>

              {matchesExpected === true ? (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Matches the expected outcome ({selected.expectedLabel})
                </div>
              ) : matchesExpected === false ? (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  <XCircle className="h-4 w-4" />
                  Differs from expected ({selected.expectedLabel}) — check the reasoning below
                </div>
              ) : (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Preview only — run the full pipeline to see the no-case behaviour.
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">Clearance</p>
                  <p className="mt-1 font-medium text-slate-800">
                    {(classifyResult ?? ingestResult?.classification)?.clearanceType ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">Intent</p>
                  <p className="mt-1 font-medium text-slate-800">
                    {(classifyResult ?? ingestResult?.classification)?.intent ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">Urgency</p>
                  <p className="mt-1 font-medium text-slate-800">
                    {(classifyResult ?? ingestResult?.classification)?.urgency ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">Response type</p>
                  <p className="mt-1 font-medium text-slate-800">
                    {(classifyResult ?? ingestResult?.classification)?.responseType ?? "—"}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>Confidence</span>
                  <span className="font-medium">
                    {Math.round(((classifyResult ?? ingestResult?.classification)?.confidence ?? 0) * 100)}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-indigo-500"
                    style={{
                      width: `${Math.round(((classifyResult ?? ingestResult?.classification)?.confidence ?? 0) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                {(classifyResult ?? ingestResult?.classification)?.explanation ??
                  "No explanation returned."}
              </p>

              {ingestResult && ingestResult.caseId && (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  <Link
                    href={`/cases/${ingestResult.caseId}`}
                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                  >
                    <LinkIcon className="h-3.5 w-3.5" /> Open case
                  </Link>
                  <Link
                    href="/ai/replies"
                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                  >
                    <LinkIcon className="h-3.5 w-3.5" /> AI Replies
                  </Link>
                  <Link
                    href="/ai/drafts"
                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                  >
                    <LinkIcon className="h-3.5 w-3.5" /> AI Drafts
                  </Link>
                </div>
              )}

              {ingestResult?.caseId === null && ingestResult?.emailEventId && (
                <p className="mt-4 text-xs text-slate-400">
                  Email stored (id {ingestResult.emailEventId.slice(0, 8)}…) but no AWB found — no
                  case was created.
                </p>
              )}
            </div>
          )}

          {classifyResult && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Stage details
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-400">
                    Rules matched
                  </p>
                  {classifyResult.stageOutputs?.rule?.matches?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {classifyResult.stageOutputs.rule.matches.map((m) => (
                        <span
                          key={m.name}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                        >
                          {m.name} ({Math.round(m.confidence * 100)}%)
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">none</p>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-400">
                    ML similar-emails prediction
                  </p>
                  {classifyResult.stageOutputs?.ml ? (
                    <p className="text-xs text-slate-600">
                      {classifyResult.stageOutputs.ml.clearanceType ?? "?"} /{" "}
                      {classifyResult.stageOutputs.ml.intent ?? "?"} (conf{" "}
                      {Math.round(classifyResult.stageOutputs.ml.confidence * 100)}%)
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">no similar emails found</p>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-400">
                    LLM verifier
                  </p>
                  {classifyResult.stageOutputs?.llm?.reasoning ? (
                    <p className="text-xs leading-relaxed text-slate-600">
                      {classifyResult.stageOutputs.llm.reasoning}
                      {classifyResult.stageOutputs.llm.flags?.length ? (
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {classifyResult.stageOutputs.llm.flags.map((f) => (
                            <span
                              key={f}
                              className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-700"
                            >
                              {f}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">no LLM output</p>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {classifyResult.classifierVersion} · {classifyResult.latencyMs}ms
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
