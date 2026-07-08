"use client";

// Placeholder until the send engine (Milestone 4) exists. Kept as its own
// component so the preview page's structure doesn't need to change when
// this gets wired up to POST /api/batches/:id/launch.
export function LaunchButton({
  batchRunId: _batchRunId,
  status: _status,
}: {
  batchRunId: string;
  status: string;
}) {
  return (
    <button
      type="button"
      disabled
      title="Sending ships in Milestone 4"
      className="cursor-not-allowed rounded-md bg-slate-300 px-4 py-2 text-sm font-medium text-white"
    >
      Launch batch (coming in Milestone 4)
    </button>
  );
}
