import "server-only";
import { NextResponse } from "next/server";

const DRAFT_TEMPLATES: Record<string, string> = {
  pdf_invoice_request: "Please find attached the invoice for AWB {AWB}. Kindly process the payment at the earliest.",
  checklist_request: "Please find attached the DO clearance checklist for AWB {AWB}. Kindly submit the required documents to proceed.",
  status_query: "The shipment for AWB {AWB} is currently under customs clearance. We will update you once it is cleared.",
  payment_received: "Thank you for confirming the payment for AWB {AWB}. The shipment will proceed for delivery.",
  reminder_needed: "This is a gentle reminder regarding AWB {AWB}. Kindly provide the required documents to avoid any delays.",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { issueType, awb, consigneeName } = body;

  if (!issueType || !awb) {
    return NextResponse.json(
      { error: "issueType and awb are required" },
      { status: 400 },
    );
  }

  const template = DRAFT_TEMPLATES[issueType as string];
  if (!template) {
    return NextResponse.json(
      {
        draft: null,
        requiresHuman: true,
        reason: `No template for issue type: ${issueType}`,
      },
    );
  }

  const draft = template
    .replace(/\{AWB\}/g, awb)
    .replace(/\{CONSIGNEE_NAME\}/g, consigneeName ?? "Customer");

  return NextResponse.json({
    draft,
    requiresHuman: false,
    issueType,
  });
}
