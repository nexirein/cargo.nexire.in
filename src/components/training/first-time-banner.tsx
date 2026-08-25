"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function FirstTimeBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const visited = localStorage.getItem("cargopaf_training_visited");
    if (visited !== "true") {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="mb-6 rounded-2xl border border-[oklch(0.45_0.25_280)_/_0.25] bg-gradient-to-r from-[oklch(0.45_0.25_280)_/_0.1] to-[oklch(0.55_0.2_280)_/_0.05] p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 bg-[oklch(0.45_0.25_280)_/_0.08] rounded-full blur-2xl" />
      <div className="relative flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[oklch(0.45_0.25_280)] text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="M8 12h3"/><path d="M8 8h6"/><path d="M8 16h5"/></svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-foreground">
            Welcome to Cargo PAF!
          </h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            New here? Start with the <span className="font-semibold text-[oklch(0.45_0.25_280)]">Training Guide</span> to understand every feature,
            workflow, and metric — organized by your role.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Link
              href="/training"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[oklch(0.45_0.25_280)] px-4 py-2 text-sm font-medium text-white hover:bg-[oklch(0.4_0.25_280)] transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="M8 12h3"/><path d="M8 8h6"/><path d="M8 16h5"/></svg>
              Open Training Guide
            </Link>
            <button
              onClick={() => {
                localStorage.setItem("cargopaf_training_visited", "true");
                setShow(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition underline underline-offset-2"
            >
              I know my way around
            </button>
          </div>
        </div>
        <button
          onClick={() => setShow(false)}
          className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
    </div>
  );
}
