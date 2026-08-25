import Link from "next/link";
import { TrainingVisitedMarker } from "@/components/training/training-visited-marker";
import { CollapsibleSidebar } from "@/components/training/collapsible-sidebar";

const problems = [
  {
    title: "Excel + VBA", stat: "90 min", statLabel: "to send 150 emails",
    desc: "Prealert mails extracted from ACCS into Excel, then VBA Excel script send emails one-by-one 'To send ~150 mails from outlook to the consignee now its taking 1.5 hour'",
  },
  {
    title: "No tracking", stat: "0%", statLabel: "visibility into send status",
    desc: "No tracking of which AWBs were sent, which failed, or which need follow-up. 'They only sent pre-alert after that no follow-up happens'",
  },
  {
    title: "Manual distribution", stat: "~50", statLabel: "replies checked daily that need no action",
    desc: "Ravi manually exports replies from Outlook into Excel. AWBs extracted by hand. Work split manually.",
  },
  {
    title: "No analytics", stat: "Blind", statLabel: "to team metrics",
    desc: "Zero visibility into team performance, reply rates, or SLA compliance.",
  },
];

const solutions = [
  {
    title: "API-based sending", stat: "3-5 min", statLabel: "to send 150 emails",
    desc: "Excel uploaded via web wizard. 150 emails sent in ~3-5 min via SMTP with parallel processing and automatic retry.",
  },
  {
    title: "Full audit trail", stat: "100%", statLabel: "audit coverage per AWB",
    desc: "Every send, every reply, every status change tracked per AWB in the database with timestamps.",
  },
  {
    title: "AI-powered triage", stat: "~60%", statLabel: "replies handled without human touch",
    desc: "Replies auto-ingested via IMAP, AWBs extracted by regex, classified by AI.",
  },
  {
    title: "Rich dashboards", stat: "Live", statLabel: "metrics at a glance",
    desc: "Real-time metrics, slipped-case alerts, team performance, reply rates, full case tracking.",
  },
];

const sidebarSections = [
  {
    group: "For Senior Management",
    color: "border-l-[oklch(0.45_0.25_280)] text-[oklch(0.45_0.25_280)]",
    items: [
      { label: "Executive Summary", href: "#exec-summary" },
      { label: "System Architecture", href: "#architecture" },
      { label: "Metrics & Outputs", href: "#metrics-outputs" },
      { label: "Tech Stack & Cost", href: "#tech-cost" },
    ],
  },
  {
    group: "For Operations Team",
    color: "border-l-emerald-500 text-emerald-600 dark:text-emerald-400",
    items: [
      { label: "End-to-End Workflow", href: "#workflow-guide" },
      { label: "Dashboard Guide", href: "#dashboard-guide" },
      { label: "Cases Guide", href: "#cases-guide" },
      { label: "Human Review", href: "#human-review-guide" },
      { label: "Reminders", href: "#reminders-guide" },
    ],
  },
  {
    group: "For Admins",
    color: "border-l-amber-500 text-amber-600 dark:text-amber-400",
    items: [
      { label: "Mailboxes", href: "#mailboxes-guide" },
      { label: "Team & Roles", href: "#team-roles-guide" },
      { label: "Audit Logs", href: "#audit-logs-guide" },
    ],
  },
];

const metricsOutputs = [
  {
    group: "Real-Time Operational Metrics",
    icon: "clock",
    color: "text-emerald-600 dark:text-emerald-400",
    items: [
      { label: "Pre-alerts sent today", detail: "Live count on dashboard. Track daily throughput at a glance." },
      { label: "Send success rate", detail: "Success vs failure per batch. Auto-retry logs for every failure." },
      { label: "Failure breakdown", detail: "By reason — bad email, attachment error, SMTP reject. Countable per batch." },
      { label: "Reply rate", detail: "% of sent AWBs that received a reply. Tracks customer engagement." },
    ],
  },
  {
    group: "Batch Intelligence",
    icon: "layers",
    color: "text-[oklch(0.45_0.25_280)]",
    items: [
      { label: "Time to complete", detail: "Per batch tracking. Compare send times across batches for optimization." },
      { label: "Per-batch status", detail: "Every batch visible through 10 lifecycle states. Full trace at all times." },
      { label: "Sub-batch performance", detail: "Split into chunks of 25-50. Monitor progress at granular level." },
      { label: "Error logs", detail: "Every failure logged with AWB, timestamp, and reason. Exportable per batch." },
    ],
  },
  {
    group: "Case Performance & Tracking",
    icon: "briefcase",
    color: "text-orange-600 dark:text-orange-400",
    items: [
      { label: "AWB status distribution", detail: "Every AWB tracked through lifecycle: awaiting_reply → claimed → closed." },
      { label: "Owner assignment", detail: "Who is handling each case. KYC-style claiming prevents duplicate work." },
      { label: "Reply timeline", detail: "Complete inbound/outbound thread per AWB. Every message timestamped." },
      { label: "AI vs human split", detail: "Cases handled by AI automatically vs those needing human review. Ratio tracked." },
    ],
  },
  {
    group: "Team Analytics",
    icon: "users",
    color: "text-amber-600 dark:text-amber-400",
    items: [
      { label: "Cases per operator", detail: "Workload distribution across team members. Balance shifts effectively." },
      { label: "Response time", detail: "Time from first reply to action taken. Track team responsiveness." },
      { label: "Slipped cases by operator", detail: "Cases past SLA, broken down by assignee. Identify who needs support." },
      { label: "Weekly performance trends", detail: "Week-over-week case volume, response time, and closure rate." },
    ],
  },
  {
    group: "AI Performance",
    icon: "brain",
    color: "text-purple-600 dark:text-purple-400",
    items: [
      { label: "Auto-handle rate", detail: "% of replies handled without human touch. Target: 60%+" },
      { label: "Classification accuracy", detail: "AI prediction vs human final action. Tracked per issue type daily." },
      { label: "Confidence distribution", detail: "Every classification scored. Low-confidence items routed to human review." },
      { label: "Issue type breakdown", detail: "Volume per type — escalation, payment, info-only, etc. Spot trends." },
    ],
  },
  {
    group: "Reminder Engine Stats",
    icon: "bell",
    color: "text-rose-600 dark:text-rose-400",
    items: [
      { label: "Reminder 1 sent", detail: "First reminders sent. Tracks how many consignees respond after R1." },
      { label: "Reminder 2 sent", detail: "Final reminders sent. These cases are near escalation threshold." },
      { label: "Escalation rate", detail: "% needing phone follow-up after both reminders. Measures urgency load." },
      { label: "Resolved before escalation", detail: "Cases where consignee replied before R2. Measures reminder effectiveness." },
    ],
  },
  {
    group: "Exportable Reports",
    icon: "download",
    color: "text-emerald-600 dark:text-emerald-400",
    items: [
      { label: "Batch performance report", detail: "Per-batch summary: sent count, failures, time, reply rate. CSV/Excel." },
      { label: "Case audit log", detail: "Every action per case with timestamp, user, state change. Compliance-ready." },
      { label: "Team performance snapshot", detail: "Cases handled, response times, slipped per operator. Weekly trends." },
      { label: "SLA compliance report", detail: "Cases within SLA vs slipped. Track adherence across the team." },
    ],
  },
];

const dashboardGuide = [
  {
    label: "Pre-alerts sent today", path: "Dashboard header, first card",
    action: "Low count? Check batch statuses and error logs.", meaning: "Count of batch emails delivered today.",
  },
  {
    label: "Replies received", path: "Dashboard header, second card",
    action: "High count with low action? AI may be catching auto-replies.", meaning: "Inbound emails ingested from monitoring mailbox today.",
  },
  {
    label: "Awaiting reply", path: "Dashboard header, third card",
    action: "Check against reminder schedules — may need escalation.", meaning: "Sent AWBs where no customer reply received yet.",
  },
  {
    label: "Review queue", path: "Dashboard header, fourth card",
    action: "Prioritize by urgency — human judgment needed most here.", meaning: "Cases flagged for human review (low AI confidence).",
  },
  {
    label: "Open cases", path: "Dashboard header, fifth card",
    action: "Review periodically — cases should trend toward closure.", meaning: "Total active cases across all statuses.",
  },
  {
    label: "Slipped cases", path: "Dashboard header, sixth card",
    action: "Address immediately — at risk of customer escalations.", meaning: "Cases past SLA or overdue for follow-up.",
  },
  {
    label: "Due reminders", path: "Dashboard header, seventh card",
    action: "Cron processes these automatically every 15 min.", meaning: "Pending reminder jobs due to be sent.",
  },
  {
    label: "Batch runs", path: "Dashboard header, eighth card",
    action: "Click through for per-batch performance and histories.", meaning: "Total batch records created in the system.",
  },
];

const workflowSteps = [
  {
    num: "01", phase: "pre-alert", title: "Create a batch",
    what: "Click 'New Batch' from sidebar. Give a reference name, select target mailbox.",
    how: "Creates a draft batch record. Nothing sent yet. Save and resume later.",
  },
  {
    num: "02", phase: "pre-alert", title: "Upload ACCS data",
    what: "Upload ACCS-exported Excel file (.xlsx). System reads all rows and shows preview.",
    how: "Each row becomes a pending item. Columns auto-detected for AWB, email, weight, destination.",
  },
  {
    num: "03", phase: "pre-alert", title: "Map & validate",
    what: "Match Excel columns to system fields. System validates every row.",
    how: "Missing emails, invalid AWBs, duplicates flagged. Fix inline or download error report.",
  },
  {
    num: "04", phase: "pre-alert", title: "Attach invoices (TIFF)",
    what: "Upload TIFF invoice files named by AWB number. Auto-matched to rows.",
    how: "Files stored in Supabase Storage. TIFFs converted to PDF client-side.",
  },
  {
    num: "05", phase: "pre-alert", title: "Preview & launch",
    what: "Review full batch — emails, attachments, recipients. Confirm and launch.",
    how: "Queued to QStash. Each email sent via SMTP with auto-retry. Progress via Realtime.",
  },
  {
    num: "06", phase: "follow-up", title: "Auto-ingest replies",
    what: "Nothing to do. System automatically polls your mailbox every 5 minutes via IMAP.",
    how: "New emails are deduplicated by Message-ID. AWBs extracted via regex (12-15 digit). Linked to existing cases.",
  },
  {
    num: "07", phase: "follow-up", title: "AI classifies & routes",
    what: "AI sorts each reply into 10 issue types. ~60% handled automatically.",
    how: "Rules catch OOO/bounces first. Then pgvector finds similar cases. Gemini classifies with confidence score. Policy router decides: auto-send, draft, human review, or urgent.",
  },
  {
    num: "08", phase: "follow-up", title: "Review & act on cases",
    what: "Check Cases page and Human Review queue. Claim cases assigned to you.",
    how: "KYC-style claiming prevents duplicate work. View full email thread. Accept AI draft, edit, or override. Close when resolved.",
  },
  {
    num: "09", phase: "follow-up", title: "Reminders escalate",
    what: "Reminder 1 auto-sent if no reply after configured delay. Reminder 2 follows if still silent.",
    how: "Cron checks every 15 min for due reminders. R1 at 48h, R2 at 72h (configurable). After R2, case flagged for phone follow-up.",
  },
];

const featureCards = [
  {
    title: "Batch Wizard", benefit: "150 emails in 3-5 min vs 90 min",
    desc: "End-to-end Excel-to-email pipeline with mapping, validation, and live progress tracking.",
  },
  {
    title: "TIFF→PDF Converter", benefit: "Invoices render in any email client",
    desc: "Client-side invoice conversion. No server uploads of raw TIFF files.",
  },
  {
    title: "Send Engine", benefit: "Reliable delivery with zero manual retry",
    desc: "SMTP with QStash queuing, automatic retry on failure, parallel sub-batch processing.",
  },
  {
    title: "IMAP Ingest", benefit: "Works with any email provider",
    desc: "Polls every 5 min. Deduplicates by Message-ID. Extracts AWBs via regex.",
  },
  {
    title: "Case Management", benefit: "Two teammates never work the same case",
    desc: "KYC-style claiming. Full timeline per AWB. Status lifecycle tracking.",
  },
  {
    title: "Reminder Engine", benefit: "No manual checking for overdue follow-ups",
    desc: "Auto-sends Reminder 1 and 2 at configurable delays. Flags for escalation.",
  },
  {
    title: "AI Classification", benefit: "~60% of replies handled without human review",
    desc: "Gemini-powered sorting into 10 issue types. Urgency detection. Confidence scoring.",
  },
  {
    title: "Dashboard & Analytics", benefit: "Data-driven ops decisions at a glance",
    desc: "Live metrics, slipped-case alerts, team performance, reply rates, batch performance.",
  },
];

const rolesPerms = [
  { role: "Admin", batch: "Full", case_: "Full (override)", admin: "Manage users, mailboxes, templates", view: "All" },
  { role: "Lead", batch: "Create & send", case_: "Assign, approve, override", admin: "Team analytics", view: "All" },
  { role: "Operator", batch: "Create & send", case_: "Claim, update, release", admin: "—", view: "Own + team" },
  { role: "Reviewer", batch: "—", case_: "Review queue only", admin: "—", view: "Review queue" },
  { role: "Viewer", batch: "—", case_: "—", admin: "—", view: "Read-only" },
];

const roadmap = [
  {
    sprint: "Sprint 1", title: "Core Pre-Alert Engine", status: "done",
    items: ["Batch wizard with Excel upload & column mapping", "TIFF→PDF client-side conversion", "SMTP send engine with QStash queue", "IMAP inbox polling every 5 min", "Dashboard & case tracking"],
  },
  {
    sprint: "Sprint 2", title: "AI Classification", status: "partial",
    items: ["AI classification endpoint (Gemini) — skeleton built", "Draft generation endpoint — built", "Human review queue UI — built", "Training data collection — pending team data"],
  },
  {
    sprint: "Sprint 3", title: "Reminder Engine", status: "done",
    items: ["Reminder scheduler via Vercel Cron", "Reminder 1/2 auto-send logic", "Slipped-case analytics on dashboard", "Reminder policy management UI"],
  },
  {
    sprint: "Sprint 4", title: "Polish & Handoff", status: "pending",
    items: ["AI calling agent (Vapi/Bolna) placeholder", "CSV/Excel export functionality", "Azure AD setup for prealert@fedex.com", "Final UAT with operations team"],
  },
];

const SectionHeading = ({ number, title, subtitle }: { number: string; title: string; subtitle: string }) => (
  <div className="mb-6">
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[oklch(0.45_0.25_280)] text-xs font-bold text-white">{number}</span>
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
    </div>
    <p className="mt-1 text-sm text-muted-foreground ml-10">{subtitle}</p>
  </div>
);

const GroupHeading = ({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) => (
  <div className="flex items-center gap-2 mb-3 mt-8 first:mt-0">
    <div className={`${color}`}>{icon}</div>
    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">{label}</h3>
    <div className="flex-1 h-px bg-border ml-2" />
  </div>
);

export default function TrainingPage() {
  return (
    <div className="flex gap-8 max-w-7xl mx-auto pb-20 relative">

      {/* ─────────── IN-PAGE SIDEBAR (collapsible) ─────────── */}
      <aside className="hidden lg:block shrink-0">
        <CollapsibleSidebar>
          <div className="space-y-6">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[oklch(0.45_0.25_280)] text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="M8 12h3"/><path d="M8 8h6"/><path d="M8 16h5"/></svg>
                </div>
                <p className="text-sm font-bold text-foreground">Training Guide</p>
              </div>
              {sidebarSections.map((group) => (
                <div key={group.group} className="mb-4">
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 border-l-2 pl-2 ${group.color}`}>
                    {group.group}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <a
                        key={item.label}
                        href={item.href}
                        className="block rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick links */}
            <div className="border-t border-border pt-4 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Quick Links</p>
              <Link href="/dashboard" className="block rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                &larr; Back to Dashboard
              </Link>
              <Link href="/batches/new" className="block rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                Create your first batch
              </Link>
            </div>
          </div>
        </CollapsibleSidebar>
      </aside>

      {/* ─────────── MAIN CONTENT ─────────── */}
      <div className="flex-1 min-w-0">

        {/* ─── HERO ─── */}
        <div className="relative overflow-hidden rounded-2xl border border-[oklch(0.45_0.25_280)_/_0.2] bg-gradient-to-br from-[oklch(0.45_0.25_280)_/_0.1] via-background to-[oklch(0.55_0.2_280)_/_0.05] p-6 md:p-10 mb-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[oklch(0.45_0.25_280)_/_0.05] rounded-full blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.45_0.25_280)_/_0.2] bg-[oklch(0.45_0.25_280)_/_0.05] px-3 py-1 text-xs font-medium text-[oklch(0.45_0.25_280)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="M8 12h3"/><path d="M8 8h6"/><path d="M8 16h5"/></svg>
              Cargo PAF v2.0
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
              Product Training Guide
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed">
              Use this guide to understand every feature, metric, and workflow in the system.
              Sections are organized by audience — jump to what matters to you.
            </p>

            {/* Mobile TOC */}
            <div className="mt-5 lg:hidden">
              <details className="group rounded-xl border border-border bg-card">
                <summary className="flex items-center justify-between p-3 cursor-pointer text-sm font-medium text-foreground">
                  <span>Jump to section</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-open:rotate-180 transition"><polyline points="6 9 12 15 18 9"/></svg>
                </summary>
                <div className="border-t border-border p-3 space-y-3">
                  {sidebarSections.map((group) => (
                    <div key={group.group}>
                      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${group.color}`}>{group.group}</p>
                      <div className="space-y-1 pl-1">
                        {group.items.map((item) => (
                          <a key={item.label} href={item.href} className="block text-xs text-muted-foreground hover:text-foreground py-1">{item.label}</a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>

            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Emails per batch", value: "~150", unit: "emails" },
                { label: "Send time", value: "3-5", unit: "minutes" },
                { label: "AI auto-handle", value: "~60%", unit: "of replies" },
                { label: "IMAP poll", value: "Every 5", unit: "minutes" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card/50 p-3 text-center">
                  <p className="text-xl font-bold text-[oklch(0.45_0.25_280)]">{s.value}<span className="text-[10px] font-normal text-muted-foreground ml-0.5">{s.unit}</span></p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
           SECTION: FOR SENIOR MANAGEMENT
           ════════════════════════════════════════════════════════════ */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.45_0.25_280)] text-white text-xs font-bold">M</div>
          <div>
            <h2 className="text-base font-bold text-foreground">For Senior Management</h2>
            <p className="text-xs text-muted-foreground">Executive overview — architecture, metrics, and business impact</p>
          </div>
        </div>

        {/* ─── 1. EXECUTIVE SUMMARY ─── */}
        <div id="exec-summary" className="scroll-mt-24">
          <SectionHeading number="01" title="Executive Summary" subtitle="The problem, the solution, and the measurable impact" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Before */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                </div>
                <h3 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Before — The Old Way</h3>
              </div>
              <div className="space-y-2.5">
                {problems.map((p) => (
                  <div key={p.title} className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-foreground">{p.title}</h4>
                      <span className="shrink-0 rounded-md bg-red-200/50 dark:bg-red-900/30 px-2 py-0.5 text-xs font-bold text-red-600 dark:text-red-400">{p.stat}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* After */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">After — Cargo PAF</h3>
              </div>
              <div className="space-y-2.5">
                {solutions.map((s) => (
                  <div key={s.title} className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-foreground">{s.title}</h4>
                      <span className="shrink-0 rounded-md bg-emerald-200/50 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">{s.stat}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Impact summary */}
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { val: "90 min → 5 min", label: "Send time reduction", sub: "95% faster email dispatch" },
              { val: "Zero → Full", label: "Audit trail", sub: "Every action per AWB tracked" },
              { val: "100% manual → 60% auto", label: "AI handling rate", sub: "AI handles majority of replies" },
              { val: "Blind → Live", label: "Team visibility", sub: "Real-time dashboards for all" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-[oklch(0.45_0.25_280)_/_0.15] bg-[oklch(0.45_0.25_280)_/_0.03] p-3.5 text-center">
                <p className="text-xs font-bold text-[oklch(0.45_0.25_280)]">{s.val}</p>
                <p className="mt-0.5 text-xs font-medium text-foreground">{s.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ─── 2. SYSTEM ARCHITECTURE ─── */}
        <div id="architecture" className="scroll-mt-24 mt-10">
          <SectionHeading number="02" title="System Architecture" subtitle="How the pieces fit together — from upload to case resolution" />

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="text-center mb-2">
              <span className="inline-block rounded-full bg-[oklch(0.45_0.25_280)_/_0.1] px-3 py-0.5 text-xs font-medium text-[oklch(0.45_0.25_280)] uppercase tracking-wider">Web App (Next.js)</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {["Batch Wizard", "Send Engine", "Case Engine", "Dashboard"].map((m) => (
                <div key={m} className="rounded-lg border border-[oklch(0.45_0.25_280)_/_0.2] bg-[oklch(0.45_0.25_280)_/_0.03] p-2.5 text-center">
                  <p className="text-xs font-semibold text-foreground">{m}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              {["IMAP Poller", "Reply Ingest", "AI Classifier", "Analytics"].map((m) => (
                <div key={m} className="rounded-lg border border-[oklch(0.45_0.25_280)_/_0.2] bg-[oklch(0.45_0.25_280)_/_0.03] p-2.5 text-center">
                  <p className="text-xs font-semibold text-foreground">{m}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-center my-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
            </div>
            <div className="text-center mb-2">
              <span className="inline-block rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Infrastructure</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { name: "Supabase", sub: "Auth, DB, Storage, Realtime" },
                { name: "Upstash Redis", sub: "Locks, Cache" },
                { name: "Upstash QStash", sub: "Send Queue" },
                { name: "SMTP / Graph API", sub: "Mail Delivery" },
              ].map((s) => (
                <div key={s.name} className="rounded-lg border border-border bg-muted/50 p-2.5 text-center">
                  <p className="text-xs font-semibold text-foreground">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>,
                title: "Security", items: ["Supabase Auth with role-based access", "Row-level security per role", "Audit log for all actions"],
              },
              {
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 12h-4V8"/></svg>,
                title: "Reliability", items: ["Auto-retry with exponential backoff", "Idempotent send (no duplicate emails)", "Distributed send locks via Redis"],
              },
              {
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
                title: "Scalability", items: ["Sub-batches of 25-50 for parallel sends", "Vercel auto-scaling functions", "4 concurrent sends per mailbox"],
              },
            ].map((s) => (
              <div key={s.title} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-[oklch(0.45_0.25_280)]">{s.icon}</div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">{s.title}</h4>
                </div>
                <ul className="space-y-1">
                  {s.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 text-emerald-500 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ─── 3. METRICS & OUTPUTS ─── */}
        <div id="metrics-outputs" className="scroll-mt-24 mt-10">
          <SectionHeading number="03" title="System Outputs & Team Intelligence" subtitle="Every data point, report, and insight the system generates for your team" />

          <div className="rounded-xl border border-[oklch(0.45_0.25_280)_/_0.15] bg-gradient-to-br from-[oklch(0.45_0.25_280)_/_0.05] to-[oklch(0.55_0.2_280)_/_0.02] p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[oklch(0.45_0.25_280)] text-white text-xs font-bold">!</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-bold text-foreground">From blind to data-driven.</span> The old process had zero metrics — no audit trail, no performance visibility.
                This system generates <span className="font-bold text-foreground">28+ structured data points</span> across 7 categories,
                accessible in real-time on the dashboard and exportable for reporting.
              </p>
            </div>
          </div>

          {metricsOutputs.map((cat) => (
            <div key={cat.group} className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <div className={cat.color}>
                  {cat.icon === "clock" && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
                  {cat.icon === "layers" && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>}
                  {cat.icon === "briefcase" && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>}
                  {cat.icon === "users" && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                  {cat.icon === "brain" && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4.5a2.5 2.5 0 0 0-4.96-.46 2.5 2.5 0 0 0-1.98 3.74 2.5 2.5 0 0 0 1.78 4.44 2.5 2.5 0 0 0 3.68 2.3 2.5 2.5 0 0 0 .48-3.86"/><path d="M13.5 8.5a2.5 2.5 0 0 0 4.5-1.5 2.5 2.5 0 0 0-4.5-1.5"/><path d="M12 4.5V2"/><path d="M12 22v-4.5"/><path d="M7.5 8.5H4"/><path d="M20 8.5h-3.5"/><path d="M7.5 15.5 5 19"/><path d="M16.5 15.5 19 19"/></svg>}
                  {cat.icon === "bell" && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
                  {cat.icon === "download" && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}
                </div>
                <h4 className="text-xs font-bold text-foreground">{cat.group}</h4>
                <div className="flex-1 h-px bg-border ml-2" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {cat.items.map((item) => (
                  <div key={item.label} className="rounded-lg border border-border bg-card p-3">
                    <p className="text-xs font-semibold text-foreground">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Count summary */}
          <div className="rounded-xl border border-[oklch(0.45_0.25_280)_/_0.15] bg-[oklch(0.45_0.25_280)_/_0.03] p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {[
                { val: "7+", label: "Metric categories" },
                { val: "28+", label: "Data points" },
                { val: "Live", label: "Real-time dashboard" },
                { val: "Exportable", label: "All reports" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-xl font-bold text-[oklch(0.45_0.25_280)]">{s.val}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── 4. TECH STACK & COST ─── */}
        <div id="tech-cost" className="scroll-mt-24 mt-10">
          <SectionHeading number="04" title="Technology Stack & Cost" subtitle="The services powering the platform and their monthly cost" />

          <div className="flex flex-wrap gap-2 mb-5">
            {[
              { name: "Next.js 16", role: "Frontend & API", cls: "bg-black text-white dark:bg-white dark:text-black" },
              { name: "Tailwind CSS", role: "UI framework", cls: "bg-sky-500 text-white" },
              { name: "Supabase", role: "Auth, DB, Storage, Realtime", cls: "bg-emerald-600 text-white" },
              { name: "Upstash QStash", role: "Send queue", cls: "bg-gray-800 text-white" },
              { name: "Upstash Redis", role: "Locks & cache", cls: "bg-red-600 text-white" },
              { name: "Google Gemini", role: "AI classification", cls: "bg-blue-600 text-white" },
              { name: "Nodemailer", role: "SMTP outbound", cls: "bg-gray-700 text-white" },
              { name: "Vercel", role: "Hosting & cron", cls: "bg-black text-white dark:bg-white dark:text-black" },
            ].map((t) => (
              <div key={t.name} className="rounded-lg border border-border bg-card p-3 min-w-[130px]">
                <div className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${t.cls}`}>{t.name}</div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">{t.role}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">Monthly Infrastructure Cost</h4>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { svc: "Vercel Pro", cost: "$20-50" },
                { svc: "Supabase Pro", cost: "$25" },
                { svc: "Upstash Redis", cost: "$5-15" },
                { svc: "QStash", cost: "Free" },
                { svc: "Gemini API", cost: "Usage" },
                { svc: "SMTP", cost: "Free-$15" },
              ].map((s) => (
                <div key={s.svc} className="rounded-lg border border-border bg-muted/50 p-2.5 text-center">
                  <p className="text-[10px] font-semibold text-foreground">{s.svc}</p>
                  <p className="text-xs font-bold text-[oklch(0.45_0.25_280)] mt-0.5">{s.cost}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground text-center">
              Total: <span className="font-bold text-foreground">$50-105/month</span> — a fraction of the time savings
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
           SECTION: FOR OPERATIONS TEAM
           ════════════════════════════════════════════════════════════ */}
        <div className="mt-14 mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white text-xs font-bold">T</div>
          <div>
            <h2 className="text-base font-bold text-foreground">For Operations Team</h2>
            <p className="text-xs text-muted-foreground">How to use every feature — step-by-step guides for daily workflows</p>
          </div>
        </div>

        {/* ─── 5. END-TO-END WORKFLOW ─── */}
        <div id="workflow-guide" className="scroll-mt-24">
          <SectionHeading number="05" title="End-to-End Workflow" subtitle="Complete journey: from ACCS Excel to sent pre-alerts to reply follow-up" />

          {/* Phase labels */}
          <div className="flex items-center gap-4 mb-4 text-xs font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[oklch(0.45_0.25_280)]" />
              <span className="text-[oklch(0.45_0.25_280)]">Phase 1: Pre-Alert</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-orange-500" />
              <span className="text-orange-600 dark:text-orange-400">Phase 2: Follow-Up</span>
            </div>
          </div>

          <div className="space-y-3">
            {workflowSteps.map((step, i) => (
              <div key={step.num} className="relative rounded-xl border border-border bg-card p-4 transition-all hover:shadow-sm">
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${
                    step.phase === "pre-alert" ? "bg-[oklch(0.45_0.25_280)]" : "bg-orange-500"
                  }`}>
                    {step.num}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-foreground">{step.title}</h4>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        step.phase === "pre-alert"
                          ? "bg-[oklch(0.45_0.25_280)_/_0.1] text-[oklch(0.45_0.25_280)]"
                          : "bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400"
                      }`}>
                        {step.phase === "pre-alert" ? "Pre-Alert" : "Follow-Up"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      <div>
                        <p className="text-[10px] font-medium text-[oklch(0.45_0.25_280)] uppercase tracking-wider">What to do</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{step.what}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-[oklch(0.45_0.25_280)] uppercase tracking-wider">How it works</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{step.how}</p>
                      </div>
                    </div>
                  </div>
                </div>
                {i < workflowSteps.length - 1 && (
                  <div className="absolute left-4 top-12 bottom-0 w-px bg-border hidden sm:block" />
                )}
              </div>
            ))}
          </div>

          {/* Batch states */}
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-2">Batch State Machine</h4>
            <div className="flex flex-wrap items-center gap-1.5">
              {["draft", "validating", "ready", "converting", "queued", "sending", "partially_sent", "completed", "failed", "archived"].map((state, i) => (
                <span key={state} className="flex items-center gap-1">
                  <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${
                    ["completed", "archived"].includes(state) ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" :
                    ["failed"].includes(state) ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400" :
                    "bg-[oklch(0.45_0.25_280)_/_0.1] text-[oklch(0.45_0.25_280)]"
                  }`}>{state}</span>
                  {i < 9 && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ─── SIDEBAR NAVIGATION REFERENCE ─── */}
        <div className="mt-10 mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground text-xs font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Sidebar Navigation Reference</h2>
            <p className="text-xs text-muted-foreground">What every item in the left sidebar does, who can access it, and when to use it</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              label: "Dashboard", icon: "grid", roles: "All roles",
              use: "Your daily home screen. View live metrics (sent today, replies, slipped cases, reminders due) and recent case activity at a glance.",
              when: "Every login — first stop of the day.",
            },
            {
              label: "Batches", icon: "package", roles: "Admin, Lead, Operator",
              use: "Create and manage pre-alert batches. Upload ACCS Excel, map columns, attach invoices, validate, preview, and launch sends.",
              when: "When new IGM data arrives from ACCS.",
            },
            {
              label: "Cases", icon: "briefcase", roles: "All roles",
              use: "Track individual AWB cases through their lifecycle. Claim cases, view reply timelines, update status, and close resolved cases.",
              when: "Daily — check assigned cases, review updates, take action.",
            },
            {
              label: "Human Review", icon: "clipboard", roles: "Admin, Lead, Reviewer",
              use: "Review queue for replies that AI couldn't handle confidently. Approve AI-generated drafts, edit them, or override classifications.",
              when: "Whenever cases land in queue. Prioritize urgent/escalation items.",
            },
            {
              label: "Reminders", icon: "bell", roles: "Admin, Lead",
              use: "View reminder policies, track auto-sent reminders, and monitor which cases are approaching escalation.",
              when: "Check daily to see which cases are nearing reminder thresholds.",
            },
            {
              label: "Calls", icon: "phone", roles: "Admin, Lead, Operator",
              use: "AI-powered phone follow-up for escalated cases (coming soon). Track call outcomes in case timeline.",
              when: "Upcoming feature — for cases past Reminder 2.",
              badge: "soon",
            },
            {
              label: "Templates", icon: "file", roles: "Admin, Lead, Operator",
              use: "Manage email templates used in pre-alerts and AI-generated reply drafts. Create, edit, and version templates.",
              when: "When setting up new email formats or updating existing ones.",
            },
            {
              label: "Mailboxes", icon: "mail", roles: "Admin only",
              use: "Configure sending (SMTP/Graph) and monitoring (IMAP) email accounts. Manage credentials and connection settings.",
              when: "Setup phase or when rotating credentials.",
            },
            {
              label: "Team", icon: "users", roles: "Admin only",
              use: "Manage users: invite new members, assign roles (Admin/Lead/Operator/Reviewer/Viewer), deactivate accounts.",
              when: "When onboarding new team members or changing roles.",
            },
            {
              label: "Audit Logs", icon: "scroll", roles: "Admin, Lead",
              use: "View all system activity: sends, status changes, case claims, overrides. Searchable by user, action, date, or AWB.",
              when: "Compliance reviews, investigations, or tracking who did what.",
            },
            {
              label: "Training Guide", icon: "book", roles: "All roles",
              use: "This page! Complete product training — architecture, workflows, metrics, and feature reference organized by role.",
              when: "First visit, onboarding, or whenever you need a refresher.",
            },
          ].map((nav) => (
            <div key={nav.label} className="rounded-xl border border-border bg-card p-4 transition-all hover:shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-xs font-bold text-foreground">{nav.label}</h4>
                {nav.badge === "soon" && (
                  <span className="rounded-md bg-sidebar-accent/50 px-1.5 py-0.5 text-[10px] font-normal text-sidebar-foreground/50">soon</span>
                )}
                <span className="ml-auto rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{nav.roles}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{nav.use}</p>
              <div className="mt-2 flex items-start gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-[oklch(0.45_0.25_280)]"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <p className="text-[10px] text-muted-foreground"><span className="font-medium text-foreground">When:</span> {nav.when}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ─── 6. DASHBOARD GUIDE ─── */}
        <div id="dashboard-guide" className="scroll-mt-24 mt-10">
          <SectionHeading number="06" title="Dashboard Guide" subtitle="What each metric means and what action to take" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dashboardGuide.map((m) => (
              <div key={m.label} className="rounded-xl border border-border bg-card p-3.5 transition-all hover:shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-bold text-foreground">{m.label}</p>
                  <span className="shrink-0 rounded-md bg-[oklch(0.45_0.25_280)_/_0.08] px-2 py-0.5 text-[10px] font-mono text-[oklch(0.45_0.25_280)]">{m.path}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">What it shows:</span> {m.meaning}
                </p>
                <p className="mt-0.5 text-xs text-[oklch(0.45_0.25_280)]">
                  <span className="font-medium">Action:</span> {m.action}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ─── 7. CASES GUIDE ─── */}
        <div id="cases-guide" className="scroll-mt-24 mt-10">
          <SectionHeading number="07" title="Cases Guide" subtitle="How to manage AWB cases from creation to closure" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                title: "Claim a case",
                desc: "When a case needs action, click 'Claim' to assign it to yourself. KYC-style locking prevents two teammates from working the same case.",
                icon: "hand",
              },
              {
                title: "Update status",
                desc: "Move cases through their lifecycle: awaiting_reply → reply_received → claimed → closed. Each change is logged with a timestamp.",
                icon: "arrow",
              },
              {
                title: "View timeline",
                desc: "Every case has a full thread of all inbound/outbound emails. See the complete conversation history in one place.",
                icon: "timeline",
              },
              {
                title: "Release a case",
                desc: "If you can't handle it, release it back to the pool. Another team member can claim it and continue.",
                icon: "release",
              },
              {
                title: "Escalate",
                desc: "Cases that need a lead's attention can be flagged. Lead reviews and either handles or reassigns.",
                icon: "alert",
              },
              {
                title: "Close & resolve",
                desc: "When the consignee's issue is resolved, mark the case closed. Closed cases remain in the audit log for compliance.",
                icon: "check",
              },
            ].map((c) => (
              <div key={c.title} className="rounded-xl border border-border bg-card p-4 transition-all hover:shadow-sm">
                <h4 className="text-xs font-bold text-foreground">{c.title}</h4>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ─── 8. HUMAN REVIEW ─── */}
        <div id="human-review-guide" className="scroll-mt-24 mt-10">
          <SectionHeading number="08" title="Human Review Guide" subtitle="How to review AI-classified replies and take action" />

          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              When AI classifies a reply with low confidence, or the issue type requires human judgment,
              the case lands in the Human Review queue. Here's how to handle it:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <p className="text-xs font-semibold text-foreground">AI already did the heavy lifting</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    AI extracts the AWB, classifies the issue type, and suggests an action (draft reply, send invoice, escalate).
                    You just review and confirm.
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
                    <p className="text-xs font-semibold text-foreground">Approve, edit, or override</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Accept the AI-drafted reply as-is, edit it before sending, or completely override the classification.
                    Your action trains future AI accuracy.
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-bold text-foreground mb-2">Issue types that reach human review:</p>
                <div className="space-y-1.5">
                  {[
                    { type: "special_case", desc: "Needs manual handling — AI can't resolve" },
                    { type: "escalation", desc: "Angry/urgent/legal — prioritize immediately" },
                    { type: "unclear", desc: "AI couldn't determine — human judgment needed" },
                  ].map((t) => (
                    <div key={t.type} className="flex items-start gap-2">
                      <span className="rounded-md bg-red-100 dark:bg-red-950/40 px-1.5 py-0.5 text-[10px] font-mono font-bold text-red-600 dark:text-red-400 shrink-0">{t.type}</span>
                      <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 9. REMINDERS ─── */}
        <div id="reminders-guide" className="scroll-mt-24 mt-10">
          <SectionHeading number="09" title="Reminders Guide" subtitle="How the automated follow-up engine works" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <h4 className="text-xs font-bold text-amber-700 dark:text-amber-300">Track A: No Reply</h4>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Reminder 1", desc: "Auto-sent if no reply within configured delay (default: 48h)", when: "No reply window expires" },
                  { label: "Reminder 2", desc: "Final reminder with escalation language (default: 72h from send)", when: "Still no reply" },
                  { label: "Flag for call", desc: "Case marked for manual phone follow-up. Future: AI calling agent.", when: "Both reminders sent" },
                ].map((t) => (
                  <div key={t.label} className="rounded-lg border border-amber-200/50 dark:border-amber-900/30 bg-white dark:bg-amber-950/10 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">{t.label}</p>
                      <span className="shrink-0 rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">{t.when}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Reminder Policies</h4>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Configure delays", desc: "Set R1 and R2 delays per policy. Different delays for different shipment types." },
                  { label: "Auto-scheduling", desc: "When a pre-alert is sent, reminder jobs are created automatically based on policy." },
                  { label: "Cron processing", desc: "Every 15 min, the system checks for due reminders and sends them automatically." },
                ].map((t) => (
                  <div key={t.label} className="rounded-lg border border-emerald-200/50 dark:border-emerald-900/30 bg-white dark:bg-emerald-950/10 p-2.5">
                    <p className="text-xs font-semibold text-foreground">{t.label}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
           SECTION: FOR ADMINS
           ════════════════════════════════════════════════════════════ */}
        <div className="mt-14 mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white text-xs font-bold">A</div>
          <div>
            <h2 className="text-base font-bold text-foreground">For Admins</h2>
            <p className="text-xs text-muted-foreground">Setup, configuration, and team management</p>
          </div>
        </div>

        {/* ─── 10. MAILBOXES ─── */}
        <div id="mailboxes-guide" className="scroll-mt-24">
          <SectionHeading number="10" title="Mailboxes" subtitle="Configure sending and monitoring mailboxes" />

          <div className="rounded-xl border border-[oklch(0.45_0.25_280)_/_0.15] bg-[oklch(0.45_0.25_280)_/_0.03] p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[oklch(0.45_0.25_280)] text-white text-xs font-bold">i</div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                <p className="font-bold text-foreground mb-1">Why two mailboxes per config?</p>
                <p className="mb-2">
                  Every mailbox configuration stores <strong className="text-foreground">two addresses</strong>:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="font-semibold text-foreground mb-1">Operational Mailbox</p>
                    <p className="text-muted-foreground">The <strong>"From"</strong> address consignees see. All pre-alert emails are sent from this address. Consignees reply to this address.</p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="font-semibold text-foreground mb-1">Tagged / CC Mailbox</p>
                    <p className="text-muted-foreground">Always <strong>CC'd</strong> on every outgoing email. The IMAP poll monitors this mailbox's INBOX to catch replies.</p>
                  </div>
                </div>
                <p className="mb-2">
                  <strong className="text-foreground">Why not just use one mailbox?</strong> Because when a consignee clicks <strong>"Reply"</strong>, the reply goes only to the From address (operational mailbox). By CC'ing a second address (tagged mailbox), we create a dedicated monitoring target:
                </p>
                <ol className="list-decimal pl-4 space-y-1 mb-2">
                  <li>Every sent email CC's the tagged mailbox — the tagged mailbox has a copy of every conversation.</li>
                  <li>When consignee clicks <strong>Reply All</strong>, the tagged mailbox gets the reply → IMAP poll picks it up.</li>
                  <li>When consignee clicks <strong>Reply</strong>, the reply goes to operational mailbox only. To catch these too, set up a <strong>mailbox forwarding rule</strong> on the operational mailbox → tagged mailbox. Now every reply, regardless of how the consignee replies, lands in the tagged mailbox.</li>
                </ol>
                <p className="text-[10px] text-muted-foreground border-t border-border pt-2 mt-2">
                  <strong>Phase 1 (Gmail):</strong> Both can be the same Gmail account. Set up a Gmail filter to auto-forward all inbound email to the IMAP-monitored address (or use Gmail's built-in forwarding).<br />
                  <strong>Phase 2 (prealert@fedex.com):</strong> Operational = shared mailbox, Tagged = dedicated sub-address. IT sets up Exchange forwarding rule from shared mailbox to the monitoring address.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <h4 className="text-xs font-bold text-foreground mb-2">Phase 1: SMTP (Current)</h4>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-2 text-xs text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 text-emerald-500 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  Use any SMTP provider (Gmail, SendGrid, etc.)
                </li>
                <li className="flex items-start gap-2 text-xs text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 text-emerald-500 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  Gmail users: enable 2FA, generate App Password
                </li>
                <li className="flex items-start gap-2 text-xs text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 text-emerald-500 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  Tagged mailbox IMAP credentials go in env vars
                </li>
              </ul>
            </div>
        </div>
        </div>

        {/* ─── 11. TEAM & ROLES ─── */}
        <div id="team-roles-guide" className="scroll-mt-24 mt-10">
          <SectionHeading number="11" title="Team & Roles" subtitle="User management and permissions matrix" />

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[oklch(0.45_0.25_280)_/_0.08]">
                  <th className="text-left p-2.5 font-bold text-foreground">Role</th>
                  <th className="text-left p-2.5 font-bold text-foreground">Batch Ops</th>
                  <th className="text-left p-2.5 font-bold text-foreground">Case Ops</th>
                  <th className="text-left p-2.5 font-bold text-foreground">Admin</th>
                  <th className="text-left p-2.5 font-bold text-foreground">View</th>
                </tr>
              </thead>
              <tbody>
                {rolesPerms.map((r) => (
                  <tr key={r.role} className="border-t border-border">
                    <td className="p-2.5 font-semibold text-foreground">{r.role}</td>
                    <td className="p-2.5 text-muted-foreground">{r.batch}</td>
                    <td className="p-2.5 text-muted-foreground">{r.case_}</td>
                    <td className="p-2.5 text-muted-foreground">{r.admin}</td>
                    <td className="p-2.5 text-muted-foreground">{r.view}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── 12. AUDIT LOGS ─── */}
        <div id="audit-logs-guide" className="scroll-mt-24 mt-10">
          <SectionHeading number="12" title="Audit Logs" subtitle="Compliance tracking and change history" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                title: "Every action logged",
                desc: "All sends, status changes, case claims, and overrides are recorded with user ID, timestamp, and before/after values.",
              },
              {
                title: "Compliance-ready",
                desc: "Full audit trail exportable for compliance reviews. Every data point has a provenance chain.",
              },
              {
                title: "Search & filter",
                desc: "Audit log is searchable by user, action type, date range, and AWB. Find any event in seconds.",
              },
            ].map((a) => (
              <div key={a.title} className="rounded-xl border border-border bg-card p-4">
                <h4 className="text-xs font-bold text-foreground">{a.title}</h4>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
           ROADMAP (shared across all roles)
           ════════════════════════════════════════════════════════════ */}
        <div className="mt-14 mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted-foreground text-white text-xs font-bold">R</div>
          <div>
            <h2 className="text-base font-bold text-foreground">Development Roadmap</h2>
            <p className="text-xs text-muted-foreground">What's built, what's in progress, what's coming</p>
          </div>
        </div>

        <div className="space-y-3">
          {roadmap.map((s) => (
            <div key={s.sprint} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white ${
                  s.status === "done" ? "bg-emerald-500" :
                  s.status === "partial" ? "bg-amber-500" : "bg-muted-foreground"
                }`}>
                  {s.status === "done" ? <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> :
                   s.status === "partial" ? <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg> :
                   <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
                </span>
                <div>
                  <p className="text-xs font-bold text-foreground">{s.sprint}: {s.title}</p>
                  <p className={`text-[10px] font-medium uppercase tracking-wider ${
                    s.status === "done" ? "text-emerald-500" :
                    s.status === "partial" ? "text-amber-500" : "text-muted-foreground"
                  }`}>{s.status === "done" ? "Complete" : s.status === "partial" ? "In Progress" : "Upcoming"}</p>
                </div>
              </div>
              <ul className="space-y-0.5">
                {s.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-[oklch(0.45_0.25_280)]"><circle cx="12" cy="12" r="10"/><path d="m10 8 4 4-4 4"/></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════
           FEATURES (reference grid)
           ════════════════════════════════════════════════════════════ */}
        <div className="mt-14 mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.45_0.25_280)] text-white text-xs font-bold">F</div>
          <div>
            <h2 className="text-base font-bold text-foreground">Feature Reference</h2>
            <p className="text-xs text-muted-foreground">Every module in the system at a glance</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {featureCards.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-4 transition-all hover:shadow-sm">
              <h4 className="text-xs font-bold text-foreground">{f.title}</h4>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              <div className="mt-2.5 rounded-md bg-[oklch(0.45_0.25_280)_/_0.08] p-1.5">
                <p className="text-[10px] font-medium text-[oklch(0.45_0.25_280)]">{f.benefit}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ─── CTA ─── */}
        <div className="mt-14 rounded-2xl border border-[oklch(0.45_0.25_280)_/_0.2] bg-gradient-to-r from-[oklch(0.45_0.25_280)_/_0.08] to-[oklch(0.55_0.2_280)_/_0.03] p-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.45_0.25_280)_/_0.2] bg-[oklch(0.45_0.25_280)_/_0.05] px-3 py-1 text-xs font-medium text-[oklch(0.45_0.25_280)] mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Ready to use
          </div>
          <h2 className="text-lg font-bold text-foreground">Ready to transform your operations?</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-lg mx-auto">
            No more Excel, VBA, or manual Outlook workflows. Everything in one dashboard.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link href="/batches/new" className="inline-flex items-center gap-1.5 rounded-lg bg-[oklch(0.45_0.25_280)] px-4 py-2 text-sm font-medium text-white hover:bg-[oklch(0.4_0.25_280)] transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
              Create your first batch
            </Link>
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition">
              View dashboard
            </Link>
          </div>
        </div>

      </div>
      <TrainingVisitedMarker />
    </div>
  );
}
