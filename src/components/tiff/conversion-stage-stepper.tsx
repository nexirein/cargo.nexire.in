import type { ConversionProgress } from "@/lib/tiff/pool";

const STAGE_LABELS: Record<ConversionProgress["stage"], string> = {
  scanning: "Scanning files",
  validating: "Validating TIFFs",
  converting: "Converting batch",
  generating: "Generating PDFs",
  packaging: "Packaging results",
  complete: "Conversion complete",
};

const STAGE_ORDER: ConversionProgress["stage"][] = [
  "scanning",
  "validating",
  "converting",
  "generating",
  "packaging",
  "complete",
];

export function ConversionStageStepper({
  progress,
}: {
  progress: ConversionProgress;
}) {
  const currentIndex = STAGE_ORDER.indexOf(progress.stage);
  const label =
    progress.stage === "converting"
      ? `${STAGE_LABELS.converting} ${progress.currentBatch}/${progress.totalBatches}`
      : STAGE_LABELS[progress.stage];

  const percent =
    progress.totalFiles === 0
      ? 0
      : Math.round((progress.completedFiles / progress.totalFiles) * 100);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-400">
          {progress.completedFiles}/{progress.totalFiles} files
        </p>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-900 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ol className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        {STAGE_ORDER.map((stage, i) => (
          <li
            key={stage}
            className={
              i <= currentIndex ? "font-medium text-slate-700" : undefined
            }
          >
            {STAGE_LABELS[stage]}
          </li>
        ))}
      </ol>
    </div>
  );
}
