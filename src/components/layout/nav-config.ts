import type { AppRole } from "@/lib/auth/session";

export interface NavItem {
  label: string;
  href: string;
  roles: AppRole[];
  comingSoon?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    roles: ["admin", "lead", "operator", "reviewer", "viewer"],
  },
  {
    label: "Batches",
    href: "/batches",
    roles: ["admin", "lead", "operator", "viewer"],
  },
  {
    label: "Cases",
    href: "/cases",
    roles: ["admin", "lead", "operator", "reviewer", "viewer"],
  },
  {
    label: "Human Review",
    href: "/human-review",
    roles: ["admin", "lead", "reviewer"],
    comingSoon: true,
  },
  {
    label: "Reminders",
    href: "/reminders",
    roles: ["admin", "lead"],
    comingSoon: true,
  },
  {
    label: "Calls",
    href: "/calls",
    roles: ["admin", "lead", "operator"],
    comingSoon: true,
  },
  {
    label: "Templates",
    href: "/templates",
    roles: ["admin", "lead"],
    comingSoon: true,
  },
  {
    label: "Mailboxes",
    href: "/admin/mailboxes",
    roles: ["admin"],
  },
  {
    label: "Team",
    href: "/admin/users",
    roles: ["admin"],
  },
  {
    label: "Audit Logs",
    href: "/audit-logs",
    roles: ["admin", "lead"],
  },
];
