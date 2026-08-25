"use client";

import { Bot, Clock, Cpu, Users } from "lucide-react";
import { InfoTip } from "@/components/ui/info-tip";

interface TierData {
  fullAuto: number;
  aiAssisted: number;
  humanLed: number;
  inProgress: number;
}

interface TaskAutomation {
  classify: { ai: number; human: number };
  reply: { ai: number; human: number; autoSend: number; draftSend: number };
  reminders: { cron: number };
  closure: { ai: number; human: number };
}

interface TimeSavedBreakdown {
  classifyActions: number;
  replyActions: number;
  reminderActions: number;
  autoCloseCases: number;
}

const EST_TIME_CLASSIFY = 2;
const EST_TIME_REPLY = 3;
const EST_TIME_REMINDER = 1;
const EST_TIME_CLOSE = 5;
const HOURLY_RATE = 200;

function formatHours(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

function pct(part: number, total: number): string {
  if (total === 0) return "0";
  return Math.round((part / total) * 100).toString();
}

export function AiImpact({
  tiers,
  taskAutomation,
  timeSaved,
  totalCases,
}: {
  tiers: TierData;
  taskAutomation: TaskAutomation;
  timeSaved: TimeSavedBreakdown;
  totalCases: number;
}) {
  const resolvedTotal = tiers.fullAuto + tiers.aiAssisted + tiers.humanLed;
  const allTotal = totalCases || 1;
  const autoPct = pct(tiers.fullAuto, allTotal);
  const assistedPct = pct(tiers.aiAssisted, allTotal);
  const humanPct = pct(tiers.humanLed, allTotal);
  const progressPct = pct(tiers.inProgress, allTotal);

  const classifyTotal = taskAutomation.classify.ai + taskAutomation.classify.human;
  const replyTotal = taskAutomation.reply.ai + taskAutomation.reply.human;
  const closeTotal = taskAutomation.closure.ai + taskAutomation.closure.human;
  const classifyAiPct = classifyTotal > 0 ? Math.round((taskAutomation.classify.ai / classifyTotal) * 100) : 0;
  const replyAiPct = replyTotal > 0 ? Math.round((taskAutomation.reply.ai / replyTotal) * 100) : 100;
  const closeAiPct = closeTotal > 0 ? Math.round((taskAutomation.closure.ai / closeTotal) * 100) : 0;
  const sendTotal = taskAutomation.reply.autoSend + taskAutomation.reply.draftSend;
  const autoSendPct = sendTotal > 0 ? Math.round((taskAutomation.reply.autoSend / sendTotal) * 100) : 0;

  const totalMinutes =
    timeSaved.classifyActions * EST_TIME_CLASSIFY +
    timeSaved.replyActions * EST_TIME_REPLY +
    timeSaved.reminderActions * EST_TIME_REMINDER +
    timeSaved.autoCloseCases * EST_TIME_CLOSE;

  const totalCostAvoided = Math.round((totalMinutes / 60) * HOURLY_RATE);

  return (
    <div className="col-span-1 sm:col-span-3 rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="rounded-xl bg-violet-500 p-3 text-white shadow-sm">
          <Bot className="h-7 w-7" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-violet-600">
            AI Impact<InfoTip text="Measures how much work the AI is handling. Full Auto-Resolution = AI did everything. AI-Assisted = AI helped with at least one task. Human-Led = operator handled it end-to-end." />
          </p>
          <p className="text-xs text-violet-500 mt-0.5">Period overview</p>
        </div>
      </div>

      {/* Tier breakdown */}
      <div className="mb-5 space-y-2">
        <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider mb-2">Ownership Breakdown</p>
        <div className="space-y-2">
          <TierRow
            label="Full Auto-Resolution"
            count={tiers.fullAuto}
            pct={autoPct}
            color="bg-emerald-500"
            tip="AI closed the case automatically without any human interaction"
          />
          <TierRow
            label="AI-Assisted"
            count={tiers.aiAssisted}
            pct={assistedPct}
            color="bg-violet-400"
            tip="AI classified the reply but a human also interacted with the case"
          />
          <TierRow
            label="Human-Led"
            count={tiers.humanLed}
            pct={humanPct}
            color="bg-amber-400"
            tip="A human handled the case end-to-end after the pre-alert was sent"
          />
          <TierRow
            label="In Progress"
            count={tiers.inProgress}
            pct={progressPct}
            color="bg-slate-300"
            tip="Case is still active — no AI classification received and no human action yet"
          />
        </div>
      </div>

      <hr className="border-violet-200 mb-4" />

      {/* Task automation rates */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider mb-2">
          Task Automation<InfoTip text="Percentage of each task type handled by AI vs manually. Higher is better for efficiency." />
        </p>
        <div className="space-y-2">
          <TaskBar label="Classify" aiPct={classifyAiPct} color="bg-sky-500" />
          <TaskBar label="Auto-Reply" aiPct={replyAiPct} color="bg-indigo-500" />
          <div className="flex items-center gap-2 pl-6">
            <span className="text-[11px] text-violet-500 w-24">Auto-Send vs Draft</span>
            <div className="flex-1 h-2 rounded-full bg-violet-100 overflow-hidden flex">
              <div className="h-full rounded-l-full bg-green-400 transition-all" style={{ width: `${autoSendPct}%` }} title={`Auto-Sent: ${taskAutomation.reply.autoSend}`} />
              <div className="h-full rounded-r-full bg-amber-400 transition-all" style={{ width: `${100 - autoSendPct}%` }} title={`Draft-Approved: ${taskAutomation.reply.draftSend}`} />
            </div>
            <span className="text-[11px] font-semibold text-violet-700 w-16 text-right tabular-nums">
              {taskAutomation.reply.autoSend}A/{taskAutomation.reply.draftSend}D
            </span>
          </div>
          <TaskBar label="Reminders" aiPct={100} color="bg-teal-500" />
          <TaskBar label="Close" aiPct={closeAiPct} color="bg-emerald-500" />
        </div>
      </div>

      <hr className="border-violet-200 mb-4" />

      {/* Hours saved */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-violet-600" />
          <span className="text-sm font-semibold text-violet-800">
            <span className="text-lg">{formatHours(totalMinutes)}h</span> saved
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-violet-600">
          <span>₹{totalCostAvoided.toLocaleString("en-IN")} avoided</span>
          <InfoTip text={
            `How this is calculated:\n` +
            `• ${timeSaved.classifyActions} classifications × ${EST_TIME_CLASSIFY} min = ${formatHours(timeSaved.classifyActions * EST_TIME_CLASSIFY)}h\n` +
            `• ${timeSaved.replyActions} auto-replies × ${EST_TIME_REPLY} min = ${formatHours(timeSaved.replyActions * EST_TIME_REPLY)}h\n` +
            `• ${timeSaved.reminderActions} reminders × ${EST_TIME_REMINDER} min = ${formatHours(timeSaved.reminderActions * EST_TIME_REMINDER)}h\n` +
            `• ${timeSaved.autoCloseCases} auto-closures × ${EST_TIME_CLOSE} min = ${formatHours(timeSaved.autoCloseCases * EST_TIME_CLOSE)}h\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `Total: ${formatHours(totalMinutes)}h × ₹${HOURLY_RATE}/hr = ₹${totalCostAvoided.toLocaleString("en-IN")}`
          } />
        </div>
      </div>
    </div>
  );
}

function TierRow({
  label,
  count,
  pct,
  color,
  tip,
}: {
  label: string;
  count: number;
  pct: string;
  color: string;
  tip: string;
}) {
  return (
    <div className="group flex items-center gap-2">
      <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
      <span className="text-xs text-violet-700 w-32">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-violet-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-violet-800 w-12 text-right tabular-nums">
        {pct}%
      </span>
      <span className="text-xs text-violet-500 w-10 text-right">{count}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
        <InfoTip text={tip} />
      </span>
    </div>
  );
}

function TaskBar({ label, aiPct, color }: { label: string; aiPct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-violet-600 w-20">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-violet-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${aiPct}%` }} />
      </div>
      <span className="text-xs font-semibold text-violet-700 w-10 text-right tabular-nums">
        {aiPct}%
      </span>
    </div>
  );
}
