const VAPI_BASE = "https://api.vapi.ai";

interface CallTaskData {
  id: string;
  awb: string;
  consignee_name: string | null;
  customer_phone: string | null;
  call_type: string;
  shipment_data?: Record<string, string>;
  missing_fields?: string[];
}

export interface VapiCallResult {
  vapiCallId: string;
  status: string;
}

export async function startVapiCall(callTask: CallTaskData): Promise<VapiCallResult> {
  const apiKey = process.env.VAPI_API_KEY;
  const assistantId = process.env.VAPI_ASSISTANT_ID;

  if (!apiKey) {
    throw new Error("VAPI_API_KEY environment variable is not set");
  }
  if (!assistantId) {
    throw new Error("VAPI_ASSISTANT_ID environment variable is not set");
  }

  const phoneNumber = callTask.customer_phone;
  if (!phoneNumber) {
    throw new Error(`No phone number for AWB ${callTask.awb}`);
  }

  const missingFields = callTask.missing_fields ?? ["clearance_type"];

  const variables: Record<string, string> = {
    awb: callTask.awb,
    consignee_name: callTask.consignee_name ?? "",
    clearance_type: callTask.call_type,
    needs_clearance: String(missingFields.includes("clearance_type")),
    needs_broker: String(missingFields.includes("broker")),
    needs_email: String(missingFields.includes("email")),
    origin: callTask.shipment_data?.origin ?? callTask.shipment_data?.["Loc"] ?? "",
    pieces: callTask.shipment_data?.pieces ?? callTask.shipment_data?.PieceQty ?? "",
    weight: callTask.shipment_data?.weight ?? callTask.shipment_data?.KiloWgt ?? "",
    freight: callTask.shipment_data?.freight ?? callTask.shipment_data?.Freight ?? "",
    currency: callTask.shipment_data?.currency ?? callTask.shipment_data?.Currency ?? "",
    shipper: callTask.shipment_data?.shipper ?? callTask.shipment_data?.["Ayush Saklani"] ?? "",
  };

  const response = await fetch(`${VAPI_BASE}/call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistantId,
      phoneNumber,
      customer: { number: phoneNumber },
      metadata: {
        callTaskId: callTask.id,
        awb: callTask.awb,
        callType: callTask.call_type,
        missingFields,
      },
      variables,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vapi call failed: ${error}`);
  }

  const data = await response.json();
  return { vapiCallId: data.id, status: data.status ?? "queued" };
}
