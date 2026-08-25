import "server-only";
import { retrieveContext } from "@/lib/ai/rag";
import { geminiChat } from "@/lib/ai/gemini";
import { loadShipmentContext, formatShipmentFacts } from "@/lib/ai/shipment-context";
import type { DraftInput, DraftResult, DraftFlag, ShipmentInfoContext } from "@/lib/ai/types";

const MAX_RETRIES = 2;

const SYSTEM_PROMPT = `You are a FedEx cargo pre-alert operations specialist replying to customer emails. Write like a human — warm, brief, conversational.

Rules:
1. Match the tone of the customer. If they write casually, reply casually. If they're formal, be formal.
2. Answer ONLY what they asked. Do NOT dump all shipment facts unless they specifically ask for them.
3. If they ask about freight charges, give just the freight amount and currency. Nothing else.
4. If they ask a vague or unclear question (like "can you give me more info?"), ask a short clarifying question. Do NOT assume what they want.
5. Keep replies short — 1-3 sentences for simple questions. Only go longer if they ask for detailed information.
6. NEVER invent or guess facts. If a fact isn't in the "Known shipment facts" block, don't mention it.
7. For MAWB/IGM that aren't generated yet, say "will be provided once generated" — keep it brief.
8. If no shipment facts are available, give a brief acknowledgment. Do NOT paste pre-alert templates.
9. Sign as "FedEx Trace Team" — one line, no elaborate closings.
10. Do NOT include DO charges tables, penalty tables, or Notification text unless specifically asked.`;

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
