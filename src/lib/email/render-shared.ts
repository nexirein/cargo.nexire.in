export interface RenderVariables {
  AWB: string;
  CONSIGNEE_NAME: string;
  CONSIGNEE_EMAIL: string;
  FREIGHT: string;
  CURRENCY: string;
  BROKER_NAME: string;
  DO_BASE: string;
  DO_ADMIN_FEE: string;
  DO_AMOUNT_DAY_OF: string;
  DO_AMOUNT_NEXT_DAY: string;
  [key: string]: string;
}

export interface RenderedTemplate {
  subject: string;
  html: string;
  ccEmails: string[];
}

export interface TemplateRow {
  id: string;
  name: string;
  type: string;
  subject_template: string;
  body_html: string;
  cc_emails: string[];
  fixed_attachment_paths: string[];
  signature_html: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderTemplateString(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = variables[key];
    return value !== undefined ? escapeHtml(value) : `{${key}}`;
  });
}

export function buildRenderVariables(
  awb: string,
  consigneeName: string | null,
  consigneeEmail: string | null,
  shipmentData: Record<string, string>,
  brokerName?: string,
): RenderVariables {
  const vars: Record<string, string> = {
    AWB: awb,
    CONSIGNEE_NAME: consigneeName ?? "Consignee",
    CONSIGNEE_EMAIL: consigneeEmail ?? "",
    FREIGHT: shipmentData["Freight"] ?? "",
    CURRENCY: shipmentData["Currency"] ?? "",
    BROKER_NAME: brokerName ?? "",
    // NFBRK Delivery Order charges (DO_BASE + 18% GST). Static regulatory
    // values, exposed as template variables so the NFBRK template never
    // hard-codes an amount that can go stale.
    DO_BASE: "2600",
    DO_ADMIN_FEE: "1000",
    DO_AMOUNT_DAY_OF: "3068",
    DO_AMOUNT_NEXT_DAY: "4248",
    ...shipmentData,
  };

  return vars as RenderVariables;
}

export function renderTemplate(
  template: TemplateRow,
  variables: RenderVariables,
  signatureHtml: string | null,
): RenderedTemplate {
  const subject = renderTemplateString(template.subject_template, variables);

  let html = renderTemplateString(template.body_html, variables);

  if (signatureHtml) {
    html = html.replace(
      "</div>",
      `<div style="margin-top:16px;white-space:pre-line;">${signatureHtml}</div>\n</div>`,
    );
  }

  return {
    subject,
    html,
    ccEmails: template.cc_emails,
  };
}
