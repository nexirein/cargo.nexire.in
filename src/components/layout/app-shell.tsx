"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import { signOut } from "@/app/(auth)/login/actions";
import { NAV_ITEMS } from "./nav-config";

export function AppShell({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="px-5 py-5">
          <p className="text-sm font-semibold tracking-tight text-slate-900">
            Cargo PAF
          </p>
          <p className="text-xs text-slate-400">Pre-Alert Operations</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span>{item.label}</span>
                {item.comingSoon ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-normal ${
                      active
                        ? "bg-white/10 text-white/70"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    soon
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <p className="truncate text-sm font-medium text-slate-900">
            {user.fullName ?? user.email}
          </p>
          <p className="text-xs text-slate-400">{ROLE_LABELS[user.role]}</p>
          <form action={signOut} className="mt-3">
            <button
              type="submit"
              className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
