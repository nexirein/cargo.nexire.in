export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center mx-0.5">
      <span className="inline-flex items-center justify-center h-4 w-4 rounded-full border border-muted-foreground/30 text-muted-foreground/40 text-[10px] font-bold cursor-help hover:border-muted-foreground hover:text-muted-foreground transition-colors select-none">
        !
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs leading-relaxed bg-slate-900 text-white rounded-lg shadow-lg z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-56 text-center">
          {text}
        </span>
      </span>
    </span>
  );
}
