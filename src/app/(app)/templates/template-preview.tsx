"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import {
  buildRenderVariables,
  renderTemplate,
} from "@/lib/email/render-shared";

interface PreviewProps {
  subjectTemplate: string;
  bodyHtml: string;
  ccEmails: string[];
  signatureHtml: string | null;
  onClose: () => void;
}

const SAMPLE_DATA: Record<string, string> = {
  AWB: "382407883458",
  CONSIGNEE_NAME: "AASHITA ENTERPRISES",
  CONSIGNEE_EMAIL: "pgupta@aashita.ai",
  FREIGHT: "8610.4",
  CURRENCY: "INR",
  BROKER_NAME: "Jeena & Co.",
  "Consignee Name": "AASHITA ENTERPRISES",
  "AWB Numbers": "382407883458",
  Agent: "Prabhat Vaish",
  Loc: "DEL",
  Date: "7/9/2026",
  BSO: "02,54",
  Freight: "8610.4",
  Currency: "INR",
  "End Result": "FEBRK",
  "FedEx Broker": "Jeena",
  Contact: "9.19414E+11",
  "ConsigneeEmailID": "PGUPTA@AASHITA.AI",
  Value: "4273927.04",
  PieceQty: "1",
  KiloWgt: "1.8",
  "AD CODE": "180212",
  "Commit date": "7/15/2026",
};

export function TemplatePreview({
  subjectTemplate,
  bodyHtml,
  ccEmails,
  signatureHtml,
  onClose,
}: PreviewProps) {
  const rendered = useMemo(() => {
    const vars = buildRenderVariables(
      SAMPLE_DATA.AWB,
      SAMPLE_DATA.CONSIGNEE_NAME,
      SAMPLE_DATA.CONSIGNEE_EMAIL,
      SAMPLE_DATA,
    );
    const template = {
      id: "preview",
      name: "Preview",
      type: "custom",
      subject_template: subjectTemplate,
      body_html: bodyHtml,
      cc_emails: ccEmails,
      fixed_attachment_paths: [],
      signature_html: signatureHtml,
    };
    return renderTemplate(template, vars, signatureHtml);
  }, [subjectTemplate, bodyHtml, ccEmails, signatureHtml]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-card shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-bold text-foreground">Email preview</h2>
          <button onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">To</p>
            <p className="mt-1 text-sm text-foreground">{SAMPLE_DATA.CONSIGNEE_EMAIL}</p>
          </div>

          {rendered.ccEmails.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">CC</p>
              <p className="mt-1 text-sm text-foreground">{rendered.ccEmails.join(", ")}</p>
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Subject</p>
            <p className="mt-1 text-sm font-medium text-foreground">{rendered.subject}</p>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <div className="border-b border-border bg-muted/30 px-4 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Body</p>
            </div>
            <div className="p-4 bg-white">
              <iframe
                srcDoc={rendered.html}
                title="Email preview"
                className="w-full border-0"
                style={{ minHeight: 400, height: "auto" }}
                sandbox=""
              />
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
            Preview uses sample data. Variables like {"{AWB}"}, {"{CONSIGNEE_NAME}"} are replaced with example values.
          </div>
        </div>
      </div>
    </div>
  );
}
