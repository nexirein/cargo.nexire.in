"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  PackageOpen,
  Briefcase,
  ClipboardCheck,
  Bell,
  Phone,
  FileText,
  Mail,
  Users,
  ScrollText,
  BookOpen,
  LogOut,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  BarChart3,
  UserCheck,
  Lock,
  Search,
  AlertTriangle,
  Database,
  Bot,
  FlaskConical,
} from "lucide-react";
import type { AppUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import { signOut } from "@/app/(auth)/login/actions";
import { NAV_ITEMS, NAV_SECTIONS } from "./nav-config";

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  PackageOpen,
  Briefcase,
  ClipboardCheck,
  Bell,
  Phone,
  FileText,
  Mail,
  Users,
  ScrollText,
  BookOpen,
  BarChart3,
  UserCheck,
  Lock,
  Search,
  AlertTriangle,
  Database,
  Bot,
  FlaskConical,
};

export function AppShell({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  function isNavItemActive(item: (typeof NAV_ITEMS)[number]) {
    const itemPath = item.href.split("?")[0];
    const itemQs = item.href.split("?")[1] ?? "";
    if (item.activePaths) return item.activePaths.includes(pathname);
    const pathMatch = pathname === itemPath || pathname.startsWith(`${itemPath}/`);
    if (!pathMatch) return false;
    if (!itemQs) return true;
    const itemParams = new URLSearchParams(itemQs);
    for (const [key, val] of itemParams.entries()) {
      if (searchParams.get(key) !== val) return false;
    }
    return true;
  }
  const groupedItems = NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: visibleItems.filter((item) => item.section === section.key),
    }))
    .filter((section) => section.items.length > 0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cargopaf_app_sidebar_collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("cargopaf_app_sidebar_collapsed", String(next));
  };

  return (
    <div className="flex min-h-screen bg-[oklch(0.97_0.005_280)]">
      {/* ─── SIDEBAR ─── */}
      <aside
        className={`fixed left-0 top-0 z-30 flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Logo */}
        <div
          className={`flex items-center border-b border-sidebar-border transition-all ${
            collapsed ? "justify-center px-2 py-5" : "gap-3 px-6 py-5"
          }`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
            CP
          </div>
          <div className={`overflow-hidden transition-all duration-300 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>
            <p className="text-sm font-semibold tracking-tight whitespace-nowrap">
              Cargo PAF
            </p>
            <p className="text-[11px] text-sidebar-foreground/60 whitespace-nowrap">
              Operations Dashboard
            </p>
          </div>

          {/* Toggle button */}
          <button
            onClick={toggle}
            className={`shrink-0 rounded-lg p-1.5 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition ${
              collapsed ? "absolute -right-3 top-5 z-10 bg-sidebar border border-sidebar-border shadow-sm" : "ml-auto"
            }`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1 scrollbar-thin">
          {groupedItems.map((section) => (
            <div key={section.key}>
              {!collapsed && (
                <p className="px-3 pt-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {section.label}
                </p>
              )}
              {section.items.map((item) => {
                const Icon = ICON_MAP[item.icon];
                const active = isNavItemActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      collapsed ? "justify-center" : ""
                    } ${
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    {Icon ? (
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? "" : "text-sidebar-foreground/50"
                        }`}
                      />
                    ) : null}
                    <span className={`overflow-hidden transition-all duration-300 ${
                      collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                    }`}>
                      {item.label}
                    </span>
                    {!collapsed && item.comingSoon ? (
                      <span className="rounded-md bg-sidebar-accent/50 px-1.5 py-0.5 text-[10px] font-normal text-sidebar-foreground/50">
                        soon
                      </span>
                    ) : null}
                    {!collapsed && active ? (
                      <ChevronRight className="h-3.5 w-3.5 text-sidebar-primary-foreground/60" />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-sidebar-border p-3">
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
              {(user.fullName ?? user.email).charAt(0).toUpperCase()}
            </div>
            <div className={`overflow-hidden transition-all duration-300 ${
              collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            }`}>
              <p className="truncate text-sm font-medium whitespace-nowrap">
                {user.fullName ?? user.email}
              </p>
              <p className="text-[11px] text-sidebar-foreground/60 whitespace-nowrap">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
          </div>
          <form action={signOut} className={`mt-3 ${collapsed ? "flex justify-center" : ""}`}>
            <button
              type="submit"
              className={`flex items-center gap-2 rounded-lg border border-sidebar-border text-xs font-medium text-sidebar-foreground/60 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                collapsed ? "justify-center px-2 py-2 w-full" : "w-full px-3 py-2"
              }`}
              title={collapsed ? "Sign out" : undefined}
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span className={`overflow-hidden transition-all duration-300 ${
                collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
              }`}>
                Sign out
              </span>
            </button>
          </form>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main
        className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ease-in-out ${
          collapsed ? "ml-16" : "ml-64"
        }`}
      >
        <header className="sticky top-0 z-10 border-b border-border bg-white/80 backdrop-blur-md">
          <div className="flex items-center justify-between px-8 py-3">
            <div>
              <p className="text-xs font-medium text-sidebar-primary/60 uppercase tracking-wider">
                {visibleItems.find((item) => isNavItemActive(item))?.label ?? "Dashboard"}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl flex-1 px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
