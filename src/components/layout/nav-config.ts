import type { AppRole } from "@/lib/auth/session";

export interface NavItem {
  label: string;
  href: string;
  roles: AppRole[];
  icon: string;
  comingSoon?: boolean;
  section: "prior" | "post" | "all" | "admin";
  /**
   * Override the default active-path matching.
   * If set, the item is active only when pathname exactly matches one of these.
   * Prevents /dashboard from highlighting on /dashboard/post.
   */
  activePaths?: string[];
}

export const NAV_SECTIONS: { key: string; label: string }[] = [
  { key: "prior", label: "PRE-ALERT" },
  { key: "post", label: "ARRIVAL & CLEARANCE" },
  { key: "all", label: "SHARED" },
  { key: "admin", label: "ADMIN" },
];

export const NAV_ITEMS: NavItem[] = [
  // ── Pre-alert ──
  {
    label: "Dashboard",
    href: "/dashboard",
    roles: ["admin", "lead", "operator", "reviewer", "viewer"],
    icon: "LayoutDashboard",
    section: "prior",
    activePaths: ["/dashboard", "/dashboard/prior"],
  },
  {
    label: "My Cases",
    href: "/my-cases?phase=pre_alert",
    roles: ["admin", "lead", "operator"],
    icon: "UserCheck",
    section: "prior",
  },
  {
    label: "Pre-alert Batches",
    href: "/batches?phase=pre_alert",
    roles: ["admin", "lead", "operator", "viewer"],
    icon: "PackageOpen",
    section: "prior",
  },
  {
    label: "Confirmation Calls",
    href: "/calls?call_type=confirmation&phase=pre_alert",
    roles: ["admin", "lead", "operator"],
    icon: "Phone",
    section: "prior",
  },
  {
    label: "Human Review",
    href: "/human-review?phase=pre_alert",
    roles: ["admin", "lead", "reviewer"],
    icon: "ClipboardCheck",
    section: "prior",
  },
  {
    label: "Reminders",
    href: "/reminders?phase=pre_alert",
    roles: ["admin", "lead", "operator"],
    icon: "Bell",
    section: "prior",
  },

  // ── Arrival & Clearance ──
  {
    label: "Dashboard",
    href: "/dashboard/post",
    roles: ["admin", "lead", "operator"],
    icon: "BarChart3",
    section: "post",
    activePaths: ["/dashboard/post"],
  },
  {
    label: "Arrival Batches",
    href: "/batches?phase=post_arrival",
    roles: ["admin", "lead", "operator", "viewer"],
    icon: "PackageOpen",
    section: "post",
  },
  {
    label: "Hold Tracker",
    href: "/holds",
    roles: ["admin", "lead", "operator"],
    icon: "Lock",
    section: "post",
  },
  {
    label: "Follow-up Calls",
    href: "/calls?call_type=follow_up,reminder&phase=post_arrival",
    roles: ["admin", "lead", "operator"],
    icon: "Phone",
    section: "post",
  },
  {
    label: "Exception Review",
    href: "/human-review?phase=post_arrival",
    roles: ["admin", "lead", "reviewer"],
    icon: "AlertTriangle",
    section: "post",
  },
  {
    label: "Reminders",
    href: "/reminders?phase=post_arrival",
    roles: ["admin", "lead", "operator"],
    icon: "Bell",
    section: "post",
  },

  // ── Shared / AI ──
  {
    label: "AI Replies",
    href: "/ai/replies",
    roles: ["admin", "lead", "operator", "reviewer"],
    icon: "Bot",
    section: "all",
  },
  {
    label: "AI Test",
    href: "/ai/test",
    roles: ["admin", "lead"],
    icon: "FlaskConical",
    section: "all",
  },
  {
    label: "AI Drafts",
    href: "/ai/drafts",
    roles: ["admin", "lead", "reviewer"],
    icon: "FileText",
    section: "all",
  },
  {
    label: "AI Follow-ups",
    href: "/ai/followups",
    roles: ["admin", "lead", "operator", "reviewer"],
    icon: "Bell",
    section: "all",
  },
  {
    label: "AI Accuracy",
    href: "/ai/accuracy",
    roles: ["admin", "lead"],
    icon: "BarChart3",
    section: "all",
  },

  // ── Shared ──
  {
    label: "All Batches",
    href: "/batches",
    roles: ["admin", "lead", "operator", "viewer"],
    icon: "PackageOpen",
    section: "all",
  },
  {
    label: "All Cases",
    href: "/cases",
    roles: ["admin", "lead", "operator", "reviewer", "viewer"],
    icon: "Briefcase",
    section: "all",
  },
  {
    label: "AWB Tracker",
    href: "/awb-tracker",
    roles: ["admin", "lead", "operator"],
    icon: "Search",
    section: "all",
  },
  {
    label: "Templates",
    href: "/templates",
    roles: ["admin", "lead", "operator"],
    icon: "FileText",
    section: "all",
  },
  {
    label: "Training Guide",
    href: "/training",
    roles: ["admin", "lead", "operator", "reviewer", "viewer"],
    icon: "BookOpen",
    section: "all",
  },

  // ── Admin ──
  {
    label: "Mailboxes",
    href: "/admin/mailboxes",
    roles: ["admin"],
    icon: "Mail",
    section: "admin",
  },
  {
    label: "Team",
    href: "/admin/users",
    roles: ["admin"],
    icon: "Users",
    section: "admin",
  },
  {
    label: "Team Analytics",
    href: "/team",
    roles: ["admin"],
    icon: "BarChart3",
    section: "admin",
  },
  {
    label: "Training Data",
    href: "/admin/training-data",
    roles: ["admin"],
    icon: "Database",
    section: "admin",
    comingSoon: true,
  },
  {
    label: "Audit Logs",
    href: "/audit-logs",
    roles: ["admin", "lead"],
    icon: "ScrollText",
    section: "admin",
  },
  {
    label: "Clearance Fill",
    href: "/clearance-fill",
    roles: ["admin", "lead", "operator"],
    icon: "Database",
    section: "prior",
  },
  {
    label: "Clearance Dashboard",
    href: "/clearance-fill/dashboard",
    roles: ["admin", "lead", "operator"],
    icon: "BarChart3",
    section: "prior",
  },
  {
    label: "Seed Master Data",
    href: "/clearance-fill/seed",
    roles: ["admin", "lead"],
    icon: "Database",
    section: "admin",
  },
  {
    label: "Broker Rules",
    href: "/clearance-fill/broker-rules",
    roles: ["admin", "lead"],
    icon: "FileText",
    section: "admin",
  },
];
