const BOLNA_BASE = "https://api.bolna.ai";

interface CallTaskData {
  id: string;
  awb: string;
  consignee_name: string | null;
  consignee_email?: string | null;
  customer_phone: string | null;
  call_type: string;
  shipment_data?: Record<string, string>;
  result_data?: Record<string, string>;
  missing_fields?: string[];
}

export interface BolnaCallResult {
  executionId: string;
  status: string;
}

export async function startBolnaCall(callTask: CallTaskData): Promise<BolnaCallResult> {
  const apiKey = process.env.BOLNA_API_KEY;
  const agentId = process.env.BOLNA_AGENT_ID;

  if (!apiKey) {
    throw new Error("BOLNA_API_KEY environment variable is not set");
  }
  if (!agentId) {
    throw new Error("BOLNA_AGENT_ID environment variable is not set");
  }

  const phoneNumber = callTask.customer_phone;
  if (!phoneNumber) {
    throw new Error(`No phone number for AWB ${callTask.awb}`);
  }

  const missingFields = callTask.missing_fields ?? ["clearance_type"];
  const sd = callTask.shipment_data ?? {};

  const rd = callTask.result_data ?? {};

  const userData: Record<string, string> = {
    awb: callTask.awb,
    consignee_name: callTask.consignee_name ?? "",
    callTaskId: callTask.id,
    callType: callTask.call_type,
    missingFields: JSON.stringify(missingFields),
    needs_clearance: String(missingFields.includes("clearance_type")),
    needs_broker: String(missingFields.includes("broker")),
    needs_email: String(missingFields.includes("email")),
    known_clearance_type: rd.known_clearance_type ?? sd.clearance_type ?? "unknown",
    known_fedex_broker: rd.known_fedex_broker ?? sd.fedex_broker ?? sd.fedexBroker ?? "unknown",
    known_consignee_email: rd.known_consignee_email ?? callTask.consignee_email ?? sd.consignee_email ?? "unknown",
    origin: sd.origin ?? sd["Loc"] ?? sd["Origin"] ?? "",
    pieces: sd.pieces ?? sd.PieceQty ?? sd["Pieces"] ?? "",
    weight: sd.weight ?? sd.KiloWgt ?? sd["Weight"] ?? "",
    freight: sd.freight ?? sd.Freight ?? "",
    currency: sd.currency ?? sd.Currency ?? "",
    shipper: sd.shipper ?? sd["Shipper"] ?? sd["Ayush Saklani"] ?? "",
    agent: sd.agent ?? sd["Agent"] ?? "",
    date: sd.date ?? sd["Date"] ?? "",
    consignee: sd.consignee ?? sd["Consignee Name"] ?? "",
    destination: sd.destination ?? sd["Destination"] ?? sd["Dest"] ?? "",
  };

  Object.entries(sd).forEach(([key, val]) => {
    if (val && !userData[key] && !["id", "created_at", "updated_at"].includes(key)) {
      userData[key] = String(val);
    }
  });

  const response = await fetch(`${BOLNA_BASE}/call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: agentId,
      recipient_phone_number: phoneNumber,
      from_phone_number: process.env.BOLNA_PHONE_NUMBER || undefined,
      user_data: userData,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bolna call failed: ${error}`);
  }

  const data = await response.json();
  return { executionId: data.execution_id, status: data.status ?? "queued" };
}
