"use client";

import { useState, useEffect, type ReactNode } from "react";

export function CollapsibleSidebar({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cargopaf_sidebar_collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("cargopaf_sidebar_collapsed", String(next));
  };

  return (
    <div className={`sticky top-24 transition-all duration-300 ${collapsed ? "w-12" : "w-64"}`}>
      <div className="relative">
        <button
          onClick={toggle}
          className="absolute -right-3 top-0 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition shadow-sm"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

        <div className={`overflow-hidden transition-all duration-300 ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          {children}
        </div>

        {collapsed && (
          <div className="flex flex-col items-center gap-3 pt-8">
            <button
              onClick={toggle}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition"
              title="Expand sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="M8 12h3"/><path d="M8 8h6"/><path d="M8 16h5"/></svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
