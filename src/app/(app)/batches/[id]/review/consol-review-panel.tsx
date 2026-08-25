"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CLEARANCE_DISPLAY } from "@/lib/cases/clearance-type";
import { Truck, Check, X, Mail, Search } from "lucide-react";

interface ReviewItem {
  id: string;
  awb: string;
  consignee_name: string | null;
  consignee_email: string | null;
  clearance_type: string | null;
  template_id: string | null;
  shipment_data: Record<string, string>;
  send_status: string;
}

export function ConsolReviewPanel({
  items,
  batchRunId,
}: {
  items: ReviewItem[];
  batchRunId: string;
}) {
  const router = useRouter();
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleResolve = useCallback(async (item: ReviewItem, newType: string) => {
    setResolving((prev) => new Set(prev).add(item.id));
    setMessage(null);
    try {
      const response = await fetch(`/api/batches/${batchRunId}/resolve-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchItemId: item.id, clearanceType: newType }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Failed to resolve item");
      }
      setMessage({ type: "success", text: `✅ ${item.awb} → ${CLEARANCE_DISPLAY[newType]?.label ?? newType}` });
      router.refresh();
    } catch (err) {
      setMessage({ type: "error", text: `Error: ${err instanceof Error ? err.message : "Unknown error"}` });
    } finally {
      setResolving((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }, [batchRunId, router]);

  const courierItems = items.filter((i) => i.clearance_type === "calling");
  const febrkItems = items.filter((i) => i.clearance_type === "febrk" || i.clearance_type === "calling");
  const nfbrkItems = items.filter((i) => i.clearance_type === "calling");
  const unresolvedItems = items.filter((i) => !i.clearance_type);

  return (
    <div>
      {message ? (
        <div className={`mx-5 mb-4 rounded-md px-3 py-2 text-xs ${
          message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        }`}>
          {message.text}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* Cargo → Courier */}
        {courierItems.length > 0 && (
          <ConsolGroup
            title="Cargo → Courier"
            icon={<Truck className="h-4 w-4" />}
            items={courierItems}
            theme="amber"
            actions={[
              { value: "courier", label: "Move to courier", style: "bg-amber-100 text-amber-700 hover:bg-amber-200" },
            ]}
            batchRunId={batchRunId}
            resolving={resolving}
            onResolve={handleResolve}
          />
        )}

        {/* FEBRK Confirmation */}
        {febrkItems.length > 0 && (
          <ConsolGroup
            title="FEBRK Confirmation"
            icon={<Search className="h-4 w-4" />}
            items={febrkItems}
            theme="orange"
            actions={[
              { value: "febrk-jeena", label: "FEBRK — Jeena", style: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
              { value: "febrk-sunimpex", label: "FEBRK — Sunimpex", style: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
            ]}
            batchRunId={batchRunId}
            resolving={resolving}
            onResolve={handleResolve}
          />
        )}

        {/* NFBRK Confirmation */}
        {nfbrkItems.length > 0 && (
          <ConsolGroup
            title="NFBRK Confirmation"
            icon={<Check className="h-4 w-4" />}
            items={nfbrkItems}
            theme="slate"
            actions={[
              { value: "nfbrk", label: "Confirm NFBRK", style: "bg-slate-100 text-slate-700 hover:bg-slate-200" },
            ]}
            batchRunId={batchRunId}
            resolving={resolving}
            onResolve={handleResolve}
          />
        )}

        {/* Unresolved */}
        {unresolvedItems.length > 0 && (
          <ConsolGroup
            title="Unresolved"
            icon={<span className="text-base">❓</span>}
            items={unresolvedItems}
            theme="slate"
            actions={[
              { value: "nfbrk", label: "NFBRK", style: "bg-slate-100 text-slate-700 hover:bg-slate-200" },
              { value: "febrk-jeena", label: "FEBRK — Jeena", style: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
              { value: "febrk-sunimpex", label: "FEBRK — Sunimpex", style: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
            ]}
            batchRunId={batchRunId}
            resolving={resolving}
            onResolve={handleResolve}
          />
        )}
      </div>
    </div>
  );
}

function ConsolGroup({
  title,
  icon,
  items,
  theme,
  actions,
  batchRunId,
  resolving,
  onResolve,
}: {
  title: string;
  icon: React.ReactNode;
  items: ReviewItem[];
  theme: "amber" | "orange" | "slate";
  actions: { value: string; label: string; style: string }[];
  batchRunId: string;
  resolving: Set<string>;
  onResolve: (item: ReviewItem, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const borderColors: Record<string, string> = {
    amber: "border-amber-200",
    orange: "border-orange-200",
    slate: "border-slate-200",
  };
  const headerBg: Record<string, string> = {
    amber: "bg-amber-50",
    orange: "bg-orange-50",
    slate: "bg-slate-50",
  };
  const headerText: Record<string, string> = {
    amber: "text-amber-800",
    orange: "text-orange-800",
    slate: "text-slate-700",
  };

  return (
    <div className={`overflow-hidden rounded-xl border ${borderColors[theme]} bg-white`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`flex w-full items-center justify-between border-b ${borderColors[theme]} ${headerBg[theme]} px-5 py-3 text-left`}
      >
        <div className="flex items-center gap-2">
          <span className={headerText[theme]}>{icon}</span>
          <h3 className={`text-sm font-semibold ${headerText[theme]}`}>
            {title} — {items.length} AWB{items.length > 1 ? "s" : ""}
          </h3>
        </div>
        <span className="text-xs text-slate-400">{expanded ? "▼" : "▶"}</span>
      </button>

      {expanded && (
        <div className="divide-y divide-slate-100">
          {items.map((item) => {
            const isResolving = resolving.has(item.id);
            const ct = item.clearance_type ?? "";
            return (
              <div key={item.id} className="px-5 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-900">{item.awb}</span>
                    {ct ? (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        CLEARANCE_DISPLAY[ct]?.bg ?? "bg-slate-100"
                      } ${CLEARANCE_DISPLAY[ct]?.text ?? "text-slate-600"}`}>
                        {CLEARANCE_DISPLAY[ct]?.dot ? (
                          <span className={`h-1.5 w-1.5 rounded-full ${CLEARANCE_DISPLAY[ct].dot}`} />
                        ) : null}
                        {CLEARANCE_DISPLAY[ct]?.label ?? ct}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        Needs type
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{item.consignee_name ?? "(no name)"}</span>
                  </div>
                </div>

                {item.shipment_data && Object.keys(item.shipment_data).length > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                    {item.shipment_data.Freight ? (
                      <span>Freight: {item.shipment_data.Freight} {item.shipment_data.Currency ?? ""}</span>
                    ) : null}
                    {item.shipment_data.PieceQty ? <span>Pieces: {item.shipment_data.PieceQty}</span> : null}
                    {item.shipment_data.KiloWgt ? <span>Weight: {item.shipment_data.KiloWgt} kg</span> : null}
                    {item.shipment_data["Loc"] ? <span>Loc: {item.shipment_data["Loc"]}</span> : null}
                    {item.shipment_data["FedEx Broker"] || item.shipment_data["fedexBroker"] ? (
                      <span>Broker: {item.shipment_data["FedEx Broker"] || item.shipment_data["fedexBroker"]}</span>
                    ) : null}
                    {item.shipment_data["Contact"] ? <span>Contact: {item.shipment_data["Contact"]}</span> : null}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {actions.map((action) => (
                    <button
                      key={action.value}
                      type="button"
                      disabled={isResolving}
                      onClick={() => onResolve(item, action.value)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${action.style}`}
                    >
                      {isResolving ? "..." : action.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
