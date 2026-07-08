const STEPS = [
  { key: "mapping", label: "Upload & map" },
  { key: "validate", label: "Validate" },
  { key: "attachments", label: "Attachments" },
  { key: "convert", label: "Convert TIFFs" },
  { key: "preview", label: "Preview" },
  { key: "send", label: "Send" },
  { key: "summary", label: "Summary" },
] as const;

export type WizardStepKey = (typeof STEPS)[number]["key"];

export function WizardSteps({ current }: { current: WizardStepKey }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
      {STEPS.map((step, index) => {
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
            {index < STEPS.length - 1 ? (
              <span className="mx-1 text-slate-300">→</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
