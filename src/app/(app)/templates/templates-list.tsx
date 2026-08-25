"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TemplateEditor } from "./template-editor";
import { CreateTemplateModal } from "./create-template-modal";

interface TemplateData {
  id: string;
  name: string;
  type: string;
  description: string | null;
  subject_template: string;
  body_html: string;
  cc_emails: string[];
  fixed_attachment_paths: string[];
  notes: string | null;
  is_active: boolean;
}

export function TemplatesList({
  templates,
  isAdmin,
}: {
  templates: TemplateData[];
  isAdmin: boolean;
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <div className="space-y-4">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground mb-4"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            <p className="text-sm font-medium text-foreground">No templates yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create your first email template.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[oklch(0.45_0.25_280)] px-4 py-2 text-sm font-medium text-white hover:bg-[oklch(0.4_0.25_280)] transition"
            >
              <Plus className="h-4 w-4" />
              Create template
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {templates.length} template{templates.length !== 1 ? "s" : ""}
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[oklch(0.45_0.25_280)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[oklch(0.4_0.25_280)] transition"
              >
                <Plus className="h-3.5 w-3.5" />
                New template
              </button>
            </div>
            {templates.map((template) => (
              <TemplateEditor
                key={template.id}
                template={{
                  id: template.id,
                  name: template.name,
                  type: template.type,
                  description: template.description ?? "",
                  subjectTemplate: template.subject_template,
                  bodyHtml: template.body_html,
                  ccEmails: template.cc_emails,
                  fixedAttachmentPaths: template.fixed_attachment_paths,
                  notes: template.notes ?? "",
                  isActive: template.is_active,
                }}
                isAdmin={isAdmin}
              />
            ))}
          </>
        )}
      </div>

      {showCreate ? (
        <CreateTemplateModal onClose={() => setShowCreate(false)} />
      ) : null}
    </>
  );
}
