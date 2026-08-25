const VAPI_BASE = "https://api.vapi.ai";

const SYSTEM_PROMPT = `You are a FedEx customer service representative calling consignees about their shipment clearance. Your tone is professional, polite, and helpful.

You have access to the following shipment data:
- AWB Number: {awb}
- Consignee Name: {consignee_name}
- Origin: {origin}
- Pieces: {pieces}
- Weight: {weight}
- Freight: {freight} {currency}
- Clearance Type: {clearance_type}
- Shipper: {shipper}

Your call purpose is to collect MISSING information. The following flags tell you what to ask about:
- needs_clearance: {needs_clearance} — "true" means you need to find out how the shipment is handled
- needs_broker: {needs_broker} — "true" means you need to find which broker handles their clearance
- needs_email: {needs_email} — "true" means you need to ask for consignee email

IMPORTANT: Customers do NOT understand terms like "NFBRK" or "FEBRK". Never use these words. Instead, talk in terms they understand:

Ask about ALL missing fields in a natural conversation flow:

1. If needs_clearance is "true": Ask "Do you handle customs clearance yourself, or does a CHA / customs broker handle it for you?"
   - If they say "we handle it ourselves" / "self" / "own" → Map to NFBRK
   - If they say "CHA" / "broker" / "agent handles it" → Map to FEBRK, then ask who the CHA is

2. If needs_broker is "true" OR if they indicated they use a CHA/broker for clearance:
   - Ask: "Which CHA or broker do you use for FedEx clearance?"
   - If they say "Jeena" → FEBRK-Jeena, fedexBroker: "Jeena & Co."
   - If they say "Sunimpex" → FEBRK-Sunimpex, fedexBroker: "Sunimpex"
   - If they say another name → FEBRK, fedexBroker: the name they gave

3. If needs_email is "true": Ask for the correct email address where they want shipment notifications and documents sent. Confirm they gave a valid email.

After the call, you must output structuredData with the following fields:
- clearanceType: "NFBRK", "FEBRK-Jeena", "FEBRK-Sunimpex", "FEBRK", or "UNKNOWN"
- fedexBroker: broker name (e.g. "Jeena & Co.", "Sunimpex", or whatever customer said), or "" if NFBRK
- consigneeEmail: the confirmed email address, or "" if not provided

Rules:
- Do NOT share confidential pricing information
- If the customer seems confused, offer to send them an email with details
- Always confirm the AWB number at the start of the call
- Take notes on the customer's response
- At the end, confirm next steps clearly`;

export interface VapiAssistant {
  id: string;
  name: string;
}

export async function createFedExAssistant(): Promise<VapiAssistant> {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    throw new Error("VAPI_API_KEY environment variable is not set");
  }

  const response = await fetch(`${VAPI_BASE}/assistant`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "FedEx Clearance Agent",
      model: {
        provider: "openai",
        model: "gpt-4",
        temperature: 0.7,
        systemPrompt: SYSTEM_PROMPT,
      },
      voice: {
        provider: "11labs",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
      },
      firstMessage:
        "Hello, this is calling from FedEx India. Am I speaking with {consignee_name}?",
      variables: [
        { name: "awb", required: true },
        { name: "consignee_name", required: true },
        { name: "origin", required: false },
        { name: "pieces", required: false },
        { name: "weight", required: false },
        { name: "freight", required: false },
        { name: "currency", required: false },
        { name: "clearance_type", required: true },
        { name: "shipper", required: false },
        { name: "needs_clearance", required: false },
        { name: "needs_broker", required: false },
        { name: "needs_email", required: false },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Vapi assistant: ${error}`);
  }

  const data = await response.json();
  return { id: data.id, name: data.name };
}
