const PHASE_STEPS: Record<string, readonly { key: string; label: string }[]> = {
  pre_alert: [
    { key: "mapping", label: "Upload & map" },
    { key: "validate", label: "Validate" },
    { key: "review", label: "Review & resolve" },
    { key: "attachments", label: "Attachments & convert" },
    { key: "preview", label: "Preview" },
    { key: "send", label: "Send" },
    { key: "summary", label: "Summary" },
  ],
  post_arrival: [
    { key: "mapping", label: "Upload & map" },
    { key: "validate", label: "Validate" },
    { key: "preview", label: "Preview" },
    { key: "send", label: "Send" },
    { key: "summary", label: "Summary" },
  ],
  tp_hold: [
    { key: "mapping", label: "Upload & map" },
    { key: "validate", label: "Validate" },
    { key: "summary", label: "Summary" },
  ],
};

export type WizardStepKey = "mapping" | "validate" | "review" | "attachments" | "preview" | "send" | "summary";

const PHASE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  pre_alert: { bg: "bg-sky-100", text: "text-sky-700", label: "Pre-alert" },
  post_arrival: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Post-arrival" },
  tp_hold: { bg: "bg-slate-100", text: "text-slate-600", label: "TP Hold" },
};

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  u_bond: { bg: "bg-sky-200", text: "text-sky-800", label: "uBond" },
  consol: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Consol" },
};

export function WizardSteps({ current, phase, preAlertType }: { current: WizardStepKey; phase?: string; preAlertType?: string }) {
  const steps = phase ? PHASE_STEPS[phase] ?? PHASE_STEPS.pre_alert : PHASE_STEPS.pre_alert;
  const currentIndex = steps.findIndex((s) => s.key === current);

  const badge = phase ? PHASE_BADGE[phase] : null;
  const typeBadge = phase === "pre_alert" && preAlertType ? TYPE_BADGE[preAlertType] : null;

  return (
    <div className="flex items-center justify-between">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step.key} className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                  active
                    ? "bg-slate-900 text-white"
                    : done
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {index + 1}
              </span>
              <span
                className={
                  active
                    ? "font-medium text-slate-900"
                    : done
                      ? "text-slate-500"
                      : "text-slate-400"
                }
              >
                {step.label}
              </span>
              {index < steps.length - 1 ? (
                <span className="mx-1 text-slate-300">→</span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {badge && (
        <span className="flex items-center gap-1.5">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
          {typeBadge && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeBadge.bg} ${typeBadge.text}`}>
              {typeBadge.label}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
