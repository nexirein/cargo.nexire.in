export default function BatchLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
        <p className="text-sm text-slate-500">Loading batch…</p>
      </div>
    </div>
  );
}
