"use client";

export default function BatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <p className="text-sm font-medium text-red-700">Something went wrong</p>
      <p className="max-w-md text-center text-xs text-red-500">
        {error.message}
      </p>
      <button
        onClick={() => reset()}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Try again
      </button>
    </div>
  );
}
