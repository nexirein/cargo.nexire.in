"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createTemplate } from "./actions";

const PLACEHOLDER_VARS = [
  { var: "{AWB}", desc: "Airway bill number" },
  { var: "{CONSIGNEE_NAME}", desc: "Consignee company name" },
  { var: "{CONSIGNEE_EMAIL}", desc: "Consignee email address" },
  { var: "{FREIGHT}", desc: "Freight charges" },
  { var: "{CURRENCY}", desc: "Currency code" },
  { var: "{BROKER_NAME}", desc: "Broker name (Jeena/Sunimpex)" },
  { var: "{PIECES}", desc: "Number of pieces" },
  { var: "{WEIGHT}", desc: "Shipment weight" },
  { var: "{DESTINATION}", desc: "Destination city" },
  { var: "{ORIGIN}", desc: "Origin city" },
  { var: "{END_RESULT}", desc: "Clearance type (FEBRK-DDP, FEBRK-DDU, NFBRK)" },
  { var: "{AGENT}", desc: "Agent name" },
  { var: "{LOC}", desc: "Location code" },
  { var: "{DATE}", desc: "Shipment date" },
  { var: "{BSO}", desc: "BSO code" },
  { var: "{CONTACT}", desc: "Contact number" },
  { var: "{VALUE}", desc: "Shipment value" },
  { var: "{PIECE_QTY}", desc: "Piece quantity" },
  { var: "{KILO_WGT}", desc: "Weight in kg" },
  { var: "{AD_CODE}", desc: "Authorized Dealer code" },
  { var: "{COMMIT_DATE}", desc: "Commit date" },
];

const TYPE_OPTIONS = [
  { value: "nfbrk", label: "NFBRK — Non-FedEx Broker" },
  { value: "febrk-jeena", label: "FEBRK — Jeena & Co." },
  { value: "febrk-sunimpex", label: "FEBRK — Sunimpex" },
  { value: "custom", label: "Custom" },
];

export function CreateTemplateModal({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [subjectPreview, setSubjectPreview] = useState("");

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await createTemplate(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(onClose, 800);
    }
  }

  function insertVar(v: string) {
    const textarea = document.getElementById("bodyHtml") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      textarea.value = val.slice(0, start) + v + val.slice(end);
      textarea.selectionStart = textarea.selectionEnd = start + v.length;
      textarea.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-12">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Create template</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add a new email template for pre-alert notifications.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form action={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">{error}</p>
          ) : null}
          {success ? (
            <p className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">Template created successfully.</p>
          ) : null}

          {/* Row 1: Name + Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-xs font-medium text-foreground mb-1">Name <span className="text-red-500">*</span></label>
              <input id="name" name="name" type="text" required
                className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-[oklch(0.45_0.25_280)] focus:outline-none focus:ring-1 focus:ring-[oklch(0.45_0.25_280)]"
                placeholder="e.g. NFBRK — Non-FedEx Broker"
              />
            </div>
            <div>
              <label htmlFor="type" className="block text-xs font-medium text-foreground mb-1">Type</label>
              <select id="type" name="type" defaultValue="custom"
                className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-[oklch(0.45_0.25_280)] focus:outline-none focus:ring-1 focus:ring-[oklch(0.45_0.25_280)]"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-xs font-medium text-foreground mb-1">Description</label>
            <input id="description" name="description" type="text"
              className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-[oklch(0.45_0.25_280)] focus:outline-none focus:ring-1 focus:ring-[oklch(0.45_0.25_280)]"
              placeholder="Brief description of when this template is used"
            />
          </div>

          {/* Subject template */}
          <div>
            <label htmlFor="subjectTemplate" className="block text-xs font-medium text-foreground mb-1">Subject template <span className="text-red-500">*</span></label>
            <div className="rounded-lg border border-border bg-[oklch(0.45_0.25_280)_/_0.03] px-3 py-2 mb-2">
              <p className="text-[10px] text-muted-foreground">
                Use <code className="rounded bg-[oklch(0.45_0.25_280)_/_0.1] px-1 text-[10px] font-mono text-[oklch(0.45_0.25_280)]">{`{VARIABLE_NAME}`}</code> for dynamic fields. These will be replaced with actual data when sending.
              </p>
            </div>
            <input
              id="subjectTemplate" name="subjectTemplate" type="text" required
              className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-[oklch(0.45_0.25_280)] focus:outline-none focus:ring-1 focus:ring-[oklch(0.45_0.25_280)]"
              placeholder="e.g. Pre Alert - {AWB} / {CONSIGNEE_NAME}"
              onChange={(e) => setSubjectPreview(e.target.value)}
            />
          </div>

          {/* CC Emails */}
          <div>
            <label htmlFor="ccEmails" className="block text-xs font-medium text-foreground mb-1">CC emails</label>
            <p className="text-[10px] text-muted-foreground mb-1">One email per line. These are always CC&apos;d on every email using this template.</p>
            <textarea
              id="ccEmails" name="ccEmails" rows={3}
              className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-[oklch(0.45_0.25_280)] focus:outline-none focus:ring-1 focus:ring-[oklch(0.45_0.25_280)]"
              placeholder="broker@example.com&#10;team@example.com"
            />
          </div>

          {/* Body HTML */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="bodyHtml" className="text-xs font-medium text-foreground">Body HTML <span className="text-red-500">*</span></label>
              <span className="text-[10px] text-muted-foreground">Click a variable to insert at cursor position:</span>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {PLACEHOLDER_VARS.map((v) => (
                <button
                  key={v.var}
                  type="button"
                  onClick={() => insertVar(v.var)}
                  className="group relative rounded-md border border-border bg-background px-2 py-1 text-[10px] font-mono text-muted-foreground hover:border-[oklch(0.45_0.25_280)] hover:text-[oklch(0.45_0.25_280)] transition"
                  title={v.desc}
                >
                  {v.var}
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-[10px] text-popover-foreground opacity-0 group-hover:opacity-100 transition pointer-events-none shadow-md">
                    {v.desc}
                  </span>
                </button>
              ))}
            </div>
            <textarea
              id="bodyHtml" name="bodyHtml" required rows={12}
              className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-[oklch(0.45_0.25_280)] focus:outline-none focus:ring-1 focus:ring-[oklch(0.45_0.25_280)]"
              placeholder='<div style="font-family: Arial, sans-serif; font-size: 14px;">&#10;  <p>Dear Sir/Madam,</p>&#10;  <p>Pre Alert - {AWB}</p>&#10;</div>'
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-xs font-medium text-foreground mb-1">Notes</label>
            <textarea
              id="notes" name="notes" rows={2}
              className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-[oklch(0.45_0.25_280)] focus:outline-none focus:ring-1 focus:ring-[oklch(0.45_0.25_280)]"
              placeholder="Internal notes about this template"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <button
              type="submit"
              disabled={success}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[oklch(0.45_0.25_280)] px-4 py-2 text-sm font-medium text-white hover:bg-[oklch(0.4_0.25_280)] transition disabled:opacity-50"
            >
              {success ? "Created!" : "Create template"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
