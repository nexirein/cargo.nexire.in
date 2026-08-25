import "server-only";
import { retrieveContext } from "@/lib/ai/rag";
import { geminiChat } from "@/lib/ai/gemini";
import { loadShipmentContext, formatShipmentFacts } from "@/lib/ai/shipment-context";
import type { DraftInput, DraftResult, DraftFlag, ShipmentInfoContext } from "@/lib/ai/types";

const MAX_RETRIES = 2;

const SYSTEM_PROMPT = `You are a FedEx cargo pre-alert operations specialist replying to customer emails. Write a professional, concise reply email.

Rules:
1. Answer the customer's question directly and concisely.
2. When the customer asks about their shipment, present the shipment details as a short structured list using ONLY the facts in the "Known shipment facts" block. Include every fact present there: AWB, consignee, clearance path, broker, pieces, weight, freight and currency, value, IEC, PIN code, mode, location, current status, and DO/IGM status.
3. NEVER invent or guess AWB numbers, values, dates, or any shipment fact. If a fact is missing from the block, do not mention it. For MAWB/IGM that are not generated yet, say they will be provided once generated.
4. If no shipment facts are available for this AWB, do NOT reproduce any pre-alert template or boilerplate. Give a brief polite acknowledgment that the details will be shared, and add the flag "missing_variables".
5. The similar replies shown below are STYLE REFERENCES ONLY. Never copy them wholesale. Never paste a pre-alert template, DO-charges table, or Notification text into a reply.
6. If the customer asks about DO charges or delivery order, state the current DO status from the facts and briefly mention the standard DO process (payment via Deldo@corp.ds.fedex.com with UTR + authority letter).
7. Keep replies brief, warm, and professional. Sign as "FedEx Trace Team".
8. Do NOT include pricing unless specifically asked. Do NOT promise delivery times — refer to tracking.`;

export async function generateDraft(input: DraftInput): Promise<DraftResult> {
  // Ground the reply in the real shipment facts whenever an AWB is known.
  const shipmentContext: ShipmentInfoContext | undefined =
    input.shipmentContext ??
    (input.awb ? await loadShipmentContext(input.awb) : null) ??
    undefined;

  const resolvedInput: DraftInput = {
    ...input,
    consigneeName: input.consigneeName ?? shipmentContext?.consigneeName ?? undefined,
    broker: input.broker ?? shipmentContext?.fedexBroker ?? undefined,
    doNumber: input.doNumber ?? shipmentContext?.doNumber ?? undefined,
    shipmentContext,
  };

  const context = await retrieveContext(input.subject, input.body, input.clearanceType, input.intent);

  const flags: DraftFlag[] = [];
  const variablesUsed: string[] = [];

  if (input.awb) variablesUsed.push("awb");
  if (resolvedInput.consigneeName) variablesUsed.push("consignee_name");
  if (resolvedInput.doNumber) variablesUsed.push("do_number");
  if (resolvedInput.broker) variablesUsed.push("broker");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      subject: `Re: ${input.subject}`,
      bodyHtml: `<p>Your query regarding AWB ${input.awb ?? "your shipment"} has been received. Our team will review and respond shortly.</p>`,
      bodyText: `Your query regarding AWB ${input.awb ?? "your shipment"} has been received. Our team will review and respond shortly.`,
      confidence: 0.5,
      flags: ["low_confidence_draft"],
      variablesUsed,
    };
  }

  const similarContext = context.similarEmails
    .slice(0, 3)
    .map((e) => `- Subject: ${e.subject}\n  Reply: ${e.actualReply}`)
    .join("\n\n");

  const factsBlock = shipmentContext
    ? formatShipmentFacts(shipmentContext)
    : "No shipment facts available for this AWB.";

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const content = await geminiChat({
        system: SYSTEM_PROMPT,
        prompt: `Generate a reply email in JSON format.

Original email:
Subject: ${input.subject}
Body: ${input.body}
Sender: ${input.sender}
Clearance Type: ${input.clearanceType}
Intent: ${input.intent}
Urgency: ${input.urgency}

Case details: AWB=${input.awb ?? "N/A"}, Consignee=${resolvedInput.consigneeName ?? "N/A"}, Broker=${resolvedInput.broker ?? "N/A"}, DO#=${resolvedInput.doNumber ?? "N/A"}

Known shipment facts (ONLY these may be stated as fact):
${factsBlock}

Similar historical replies (style reference only — never copy verbatim):
${similarContext || "No similar emails found."}

Return JSON:
{
  "subject": "Re: ...",
  "body_html": "<p>...</p>",
  "body_text": "...",
  "confidence": 0.0-1.0,
  "flags": ["list of flags if any"]
}`,
        temperature: 0.3,
        jsonMode: true,
      });

      if (!content) {
        throw new Error("Empty LLM response");
      }

      const parsed = JSON.parse(content);
      const draftFlags: DraftFlag[] = [...flags];

      if (parsed.flags?.includes("missing_attachment")) draftFlags.push("missing_attachment_reference");
      if (parsed.flags?.includes("date")) draftFlags.push("needs_dates_confirmation");
      if (parsed.confidence < 0.8) draftFlags.push("low_confidence_draft");

      return {
        subject: parsed.subject,
        bodyHtml: parsed.body_html,
        bodyText: parsed.body_text,
        confidence: parsed.confidence ?? 0.8,
        flags: draftFlags,
        variablesUsed,
        templateId: context.bestTemplate?.id,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[ai/draft] Draft generation attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  return {
    subject: `Re: ${input.subject}`,
    bodyHtml: `<p>Your query regarding AWB ${input.awb ?? "your shipment"} has been received. Our team will review and respond.</p>`,
    bodyText: `Your query regarding AWB ${input.awb ?? "your shipment"} has been received. Our team will review and respond.`,
    confidence: 0.4,
    flags: ["low_confidence_draft"],
    variablesUsed,
  };
}
