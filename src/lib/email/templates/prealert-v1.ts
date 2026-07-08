export interface PrealertTemplateInput {
  consigneeName: string | null;
  awb: string;
  shipmentData: Record<string, string>;
  signatureHtml: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

/**
 * The single built-in pre-alert template for this phase (spec's
 * "Templates" module is a future-phase feature). `template_id` is still
 * persisted per send in `batch_items` so a managed template library can
 * slot in later without a data migration.
 */
export function renderPrealertEmail(input: PrealertTemplateInput): RenderedEmail {
  const greetingName = input.consigneeName ?? "Consignee";
  const subject = `Pre-Alert: Shipment ${input.awb} Incoming`;

  const detailRows = Object.entries(input.shipmentData)
    .filter(([, value]) => value)
    .map(
      ([key, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">${escapeHtml(
          key,
        )}</td><td style="padding:4px 0;color:#0f172a;">${escapeHtml(
          value,
        )}</td></tr>`,
    )
    .join("");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;">
      <p>Dear ${escapeHtml(greetingName)},</p>
      <p>This is a pre-alert for shipment <strong>${escapeHtml(
        input.awb,
      )}</strong>, expected to arrive shortly. Please find the invoice attached.</p>
      <table style="border-collapse:collapse;margin:16px 0;">${detailRows}</table>
      <p>Please review the attached invoice and reach out if anything looks incorrect.</p>
      ${
        input.signatureHtml
          ? `<div style="margin-top:16px;white-space:pre-line;">${escapeHtml(
              input.signatureHtml,
            )}</div>`
          : ""
      }
    </div>
  `;

  return { subject, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
