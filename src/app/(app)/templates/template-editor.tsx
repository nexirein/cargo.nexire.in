"use client";

import { useState, useRef } from "react";
import { ChevronDown, ChevronUp, Eye, X, HelpCircle } from "lucide-react";
import { updateTemplate, toggleTemplateActive, uploadTemplateAttachment, deleteTemplateAttachment } from "./actions";
import { TemplatePreview } from "./template-preview";

interface TemplateProp {
  id: string;
  name: string;
  type: string;
  description: string;
  subjectTemplate: string;
  bodyHtml: string;
  ccEmails: string[];
  fixedAttachmentPaths: string[];
  notes: string;
  isActive: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  nfbrk: "NFBRK",
  "febrk-jeena": "FEBRK — Jeena",
  "febrk-sunimpex": "FEBRK — Sunimpex",
  custom: "Custom",
};

const TYPE_COLOR: Record<string, string> = {
  nfbrk: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  "febrk-jeena": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  "febrk-sunimpex": "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  custom: "bg-muted text-muted-foreground",
};

export function TemplateEditor({
  template,
  isAdmin,
}: {
  template: TemplateProp;
  isAdmin: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachments, setAttachments] = useState(template.fixedAttachmentPaths);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function attachmentName(path: string) {
    return path.split("/").pop() ?? path;
  }

  function AttachmentDownloadLink({ path }: { path: string }) {
    const [loading, setLoading] = useState(false);

    async function handleDownload() {
      setLoading(true);
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data, error } = await supabase.storage
          .from("template-attachments")
          .download(path);
        if (error || !data) throw error ?? new Error("Download failed");

        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = path.split("/").pop() ?? path;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        try {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const { data: signed } = await supabase.storage
            .from("template-attachments")
            .createSignedUrl(path, 60);
          if (signed?.signedUrl) {
            window.open(signed.signedUrl, "_blank");
          }
        } catch {
          // ignore
        }
      }
      setLoading(false);
    }

    return (
      <button type="button" onClick={handleDownload} disabled={loading}
        className="text-[10px] font-medium text-[oklch(0.45_0.25_280)] hover:underline"
      >
        {loading ? "..." : "View"}
      </button>
    );
  }

  async function handleSave(formData: FormData) {
    setError(null);
    setSuccess(false);
    formData.set("fixedAttachmentPaths", attachments.join("\n"));
    const result = await updateTemplate(template.id, formData);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setError(null);

    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadTemplateAttachment(template.id, fd);

    if (result.error) {
      setError(result.error);
    } else if (result.fileName) {
      setAttachments((prev) => [...prev, `${template.id}/${result.fileName!}`]);
    }

    setUploadingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDeleteAttachment(path: string) {
    setError(null);
    try {
      await deleteTemplateAttachment(template.id, path);
      setAttachments((prev) => prev.filter((p) => p !== path));
    } catch {
      setError("Failed to delete attachment.");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-accent/30"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">{template.name}</h3>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${TYPE_COLOR[template.type] ?? TYPE_COLOR.custom}`}>
              {TYPE_LABEL[template.type] ?? template.type}
            </span>
            {!template.isActive ? (
              <span className="rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-medium">Inactive</span>
            ) : null}
          </div>
          {template.description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{template.description}</p>
          ) : null}
          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>Subject: <code className="rounded bg-muted px-1 py-0.5 font-mono">{template.subjectTemplate}</code></span>
            {template.ccEmails.length > 0 ? (
              <span>CC: {template.ccEmails.length}</span>
            ) : null}
            {attachments.length > 0 ? (
              <span>Attachments: {attachments.length}</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded editor */}
      {expanded ? (
        <form action={handleSave} className="border-t border-border p-5 space-y-5">
          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">{error}</p>
          ) : null}
          {success ? (
            <p className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">Saved successfully.</p>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`name-${template.id}`} className="block text-xs font-medium text-foreground mb-1">Name</label>
              <input id={`name-${template.id}`} name="name" type="text" required
                defaultValue={template.name}
                className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-[oklch(0.45_0.25_280)] focus:outline-none focus:ring-1 focus:ring-[oklch(0.45_0.25_280)]"
              />
            </div>
            <div>
              <label htmlFor={`desc-${template.id}`} className="block text-xs font-medium text-foreground mb-1">Description</label>
              <input id={`desc-${template.id}`} name="description" type="text"
                defaultValue={template.description}
                className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-[oklch(0.45_0.25_280)] focus:outline-none focus:ring-1 focus:ring-[oklch(0.45_0.25_280)]"
              />
            </div>
          </div>

          <div>
            <label htmlFor={`subject-${template.id}`} className="block text-xs font-medium text-foreground mb-1">Subject template</label>
            <div className="rounded-lg border border-border bg-[oklch(0.45_0.25_280)_/_0.03] px-3 py-1.5 mb-2">
              <p className="text-[10px] text-muted-foreground">
                Use <code className="rounded bg-[oklch(0.45_0.25_280)_/_0.1] px-1 text-[10px] font-mono text-[oklch(0.45_0.25_280)]">{`{VARIABLE_NAME}`}</code> for dynamic fields.
              </p>
            </div>
            <input id={`subject-${template.id}`} name="subjectTemplate" type="text" required
              defaultValue={template.subjectTemplate}
              className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-[oklch(0.45_0.25_280)] focus:outline-none focus:ring-1 focus:ring-[oklch(0.45_0.25_280)]"
            />
          </div>

          {/* Variable reference */}
          <VariableReference />

          <div>
            <label htmlFor={`cc-${template.id}`} className="block text-xs font-medium text-foreground mb-1">CC emails</label>
            <p className="text-[10px] text-muted-foreground mb-1">One per line.</p>
            <textarea id={`cc-${template.id}`} name="ccEmails" rows={3}
              defaultValue={template.ccEmails.join("\n")}
              className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-[oklch(0.45_0.25_280)] focus:outline-none focus:ring-1 focus:ring-[oklch(0.45_0.25_280)]"
            />
          </div>

          <div>
            <label htmlFor={`body-${template.id}`} className="block text-xs font-medium text-foreground mb-1">Body HTML</label>
            <div className="rounded-lg border border-border bg-[oklch(0.45_0.25_280)_/_0.03] px-3 py-1.5 mb-2">
              <p className="text-[10px] text-muted-foreground">
                Use <code className="rounded bg-[oklch(0.45_0.25_280)_/_0.1] px-1 text-[10px] font-mono text-[oklch(0.45_0.25_280)]">{`{VARIABLE_NAME}`}</code> placeholders. Signature is appended automatically.
              </p>
            </div>
            <textarea id={`body-${template.id}`} name="bodyHtml" required rows={12}
              defaultValue={template.bodyHtml}
              className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-[oklch(0.45_0.25_280)] focus:outline-none focus:ring-1 focus:ring-[oklch(0.45_0.25_280)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Fixed attachments</label>
            <p className="text-[10px] text-muted-foreground mb-2">
              Files that are always attached with this template (e.g. DO FORMAT.docx, BANK DETAILS.docx).
            </p>
            {attachments.length > 0 ? (
              <div className="space-y-1 mb-2">
                {attachments.map((path) => (
                  <div key={path} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <span className="text-xs text-foreground">{attachmentName(path)}</span>
                    <div className="flex items-center gap-2">
                      <AttachmentDownloadLink path={path} />
                      <button type="button" onClick={() => handleDeleteAttachment(path)}
                        className="text-[10px] font-medium text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mb-2">No attachments yet.</p>
            )}
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" onChange={handleFileUpload} disabled={uploadingFile}
                className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-[oklch(0.45_0.25_280)] file:px-3 file:py-1.5 file:text-[10px] file:font-medium file:text-white hover:file:bg-[oklch(0.4_0.25_280)]"
              />
              {uploadingFile ? <span className="text-xs text-muted-foreground">Uploading...</span> : null}
            </div>
          </div>

          <div>
            <label htmlFor={`notes-${template.id}`} className="block text-xs font-medium text-foreground mb-1">Notes</label>
            <textarea id={`notes-${template.id}`} name="notes" rows={2}
              defaultValue={template.notes}
              className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-[oklch(0.45_0.25_280)] focus:outline-none focus:ring-1 focus:ring-[oklch(0.45_0.25_280)]"
            />
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <button type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[oklch(0.45_0.25_280)] px-4 py-2 text-sm font-medium text-white hover:bg-[oklch(0.4_0.25_280)] transition"
            >
              Save
            </button>
            <button type="button" onClick={() => setShowPreview(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition"
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
            {isAdmin ? (
              <button type="button"
                onClick={async () => {
                  const fd = new FormData();
                  await toggleTemplateActive(template.id, !template.isActive, fd);
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition"
              >
                {template.isActive ? "Deactivate" : "Activate"}
              </button>
            ) : null}
            <button type="button" onClick={() => setExpanded(false)}
              className="ml-auto rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </form>
      ) : null}

      {showPreview ? (
        <TemplatePreview
          subjectTemplate={template.subjectTemplate}
          bodyHtml={template.bodyHtml}
          ccEmails={template.ccEmails}
          signatureHtml={null}
          onClose={() => setShowPreview(false)}
        />
      ) : null}
    </div>
  );
}

const COMMON_VARS = [
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

function VariableReference() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground transition hover:bg-accent/30"
      >
        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
        Available variables ({COMMON_VARS.length})
        {open ? <ChevronUp className="ml-auto h-3 w-3 text-muted-foreground" /> : <ChevronDown className="ml-auto h-3 w-3 text-muted-foreground" />}
      </button>
      {open ? (
        <div className="border-t border-border px-3 py-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
            {COMMON_VARS.map((v) => (
              <div key={v.var} className="flex items-center gap-1.5 text-[10px]">
                <code className="rounded bg-[oklch(0.45_0.25_280)_/_0.1] px-1 font-mono text-[oklch(0.45_0.25_280)]">{v.var}</code>
                <span className="text-muted-foreground truncate">{v.desc}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground border-t border-border pt-2">
            Any column in your Excel upload becomes available as a {"{COLUMN_NAME}"} variable automatically.
          </p>
        </div>
      ) : null}
    </div>
  );
}
