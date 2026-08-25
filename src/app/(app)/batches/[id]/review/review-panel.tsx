"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CLEARANCE_DISPLAY } from "@/lib/cases/clearance-type";
import { Pencil, Check, X, Phone, Search } from "lucide-react";

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

const CALL_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-amber-100", text: "text-amber-700", label: "⏳ Pending" },
  in_progress: { bg: "bg-blue-100", text: "text-blue-700", label: "📞 Calling…" },
  completed: { bg: "bg-emerald-100", text: "text-emerald-700", label: "✅ Completed" },
  done: { bg: "bg-emerald-100", text: "text-emerald-700", label: "✅ Done" },
  failed: { bg: "bg-red-100", text: "text-red-700", label: "❌ Failed" },
  skipped: { bg: "bg-slate-100", text: "text-slate-500", label: "⏭ Skipped" },
};

export function ReviewPanel({
  items,
  batchRunId,
  callByItemId,
}: {
  items: ReviewItem[];
  batchRunId: string;
  callByItemId?: Map<string, { id: string; status: string; callType: string }>;
}) {
  const router = useRouter();
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleManualResolve = useCallback(async (item: ReviewItem, newType: string) => {
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

  const handleAssignToAI = useCallback(async (item: ReviewItem, callType: string) => {
    setAssigning((prev) => new Set(prev).add(item.id));
    setMessage(null);
    try {
      const response = await fetch(`/api/batches/${batchRunId}/assign-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchItemId: item.id, callType }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Failed to assign call");
      }
      setMessage({ type: "success", text: `📞 ${item.awb} → AI call assigned (${callType})` });
    } catch (err) {
      setMessage({ type: "error", text: `Error: ${err instanceof Error ? err.message : "Unknown error"}` });
    } finally {
      setAssigning((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }, [batchRunId]);

  const handleAssignGroup = useCallback(async (groupItems: ReviewItem[], callType: string) => {
    setAssigning((prev) => {
      const next = new Set(prev);
      groupItems.forEach((i) => next.add(i.id));
      return next;
    });
    setMessage(null);
    try {
      const response = await fetch(`/api/batches/${batchRunId}/assign-all-calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchItemIds: groupItems.map((i) => i.id), callType }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Failed to assign");
      }
      setMessage({ type: "success", text: `📞 ${groupItems.length} item(s) assigned to AI calling` });
      router.refresh();
    } catch (err) {
      setMessage({ type: "error", text: `Error: ${err instanceof Error ? err.message : "Unknown error"}` });
    } finally {
      setAssigning((prev) => {
        const next = new Set(prev);
        groupItems.forEach((i) => next.delete(i.id));
        return next;
      });
    }
  }, [batchRunId, router]);

  const startEditing = (item: ReviewItem) => {
    setEditingId(item.id);
    setEditValue(item.clearance_type ?? "");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (item: ReviewItem) => {
    if (!editValue || editValue === item.clearance_type) {
      cancelEditing();
      return;
    }
    await handleManualResolve(item, editValue);
    cancelEditing();
  };

  const callingItems = items.filter((i) => i.clearance_type === "calling");
  const febrkItems = items.filter((i) => i.clearance_type === "febrk");
  const unresolvedItems = items.filter((i) => !i.clearance_type);

  const groupCount = [callingItems.length > 0, febrkItems.length > 0, unresolvedItems.length > 0].filter(Boolean).length;

  return (
    <div>
      {message ? (
        <div className={`mx-5 mb-4 rounded-md px-3 py-2 text-xs ${
          message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        }`}>
          {message.text}
        </div>
      ) : null}

      <div className={`grid grid-cols-1 gap-4 ${groupCount >= 2 ? "sm:grid-cols-2" : ""} ${groupCount >= 3 ? "lg:grid-cols-3" : ""}`}>
        {callingItems.length > 0 && (
          <ItemGroup
            title="Calling"
            icon={<Phone className="h-4 w-4" />}
            items={callingItems}
            theme="amber"
            resolveOptions={[
              { value: "nfbrk", label: "NFBRK" },
              { value: "febrk-jeena", label: "FEBRK — Jeena" },
              { value: "febrk-sunimpex", label: "FEBRK — Sunimpex" },
            ]}
            aiCallType="confirmation"
            batchRunId={batchRunId}
            resolving={resolving}
            assigning={assigning}
            editingId={editingId}
            editValue={editValue}
            callByItemId={callByItemId}
            onResolve={handleManualResolve}
            onAssignToAI={handleAssignToAI}
            onStartEdit={startEditing}
            onCancelEdit={cancelEditing}
            onEditChange={(v) => setEditValue(v)}
            onSaveEdit={saveEdit}
            onAssignGroup={handleAssignGroup}
          />
        )}

        {febrkItems.length > 0 && (
          <ItemGroup
            title="FEBRK"
            icon={<Search className="h-4 w-4" />}
            items={febrkItems}
            theme="orange"
            resolveOptions={[
              { value: "febrk-jeena", label: "FEBRK — Jeena" },
              { value: "febrk-sunimpex", label: "FEBRK — Sunimpex" },
            ]}
            aiCallType="broker_lookup"
            batchRunId={batchRunId}
            resolving={resolving}
            assigning={assigning}
            editingId={editingId}
            editValue={editValue}
            callByItemId={callByItemId}
            onResolve={handleManualResolve}
            onAssignToAI={handleAssignToAI}
            onStartEdit={startEditing}
            onCancelEdit={cancelEditing}
            onEditChange={(v) => setEditValue(v)}
            onSaveEdit={saveEdit}
            onAssignGroup={handleAssignGroup}
          />
        )}

        {unresolvedItems.length > 0 && (
          <ItemGroup
            title="Unresolved"
            icon={<span className="text-base">❓</span>}
            items={unresolvedItems}
            theme="slate"
            resolveOptions={[
              { value: "nfbrk", label: "NFBRK" },
              { value: "febrk-jeena", label: "FEBRK — Jeena" },
              { value: "febrk-sunimpex", label: "FEBRK — Sunimpex" },
            ]}
            aiCallType={null}
            batchRunId={batchRunId}
            resolving={resolving}
            assigning={assigning}
            editingId={editingId}
            editValue={editValue}
            callByItemId={callByItemId}
            onResolve={handleManualResolve}
            onAssignToAI={handleAssignToAI}
            onStartEdit={startEditing}
            onCancelEdit={cancelEditing}
            onEditChange={(v) => setEditValue(v)}
            onSaveEdit={saveEdit}
            onAssignGroup={handleAssignGroup}
          />
        )}
      </div>
    </div>
  );
}

function ItemGroup({
  title,
  icon,
  items,
  theme,
  resolveOptions,
  aiCallType,
  batchRunId,
  resolving,
  assigning,
  editingId,
  editValue,
  callByItemId,
  onResolve,
  onAssignToAI,
  onStartEdit,
  onCancelEdit,
  onEditChange,
  onSaveEdit,
  onAssignGroup,
}: {
  title: string;
  icon: React.ReactNode;
  items: ReviewItem[];
  theme: "amber" | "orange" | "slate";
  resolveOptions: { value: string; label: string }[];
  aiCallType: string | null;
  batchRunId: string;
  resolving: Set<string>;
  assigning: Set<string>;
  editingId: string | null;
  editValue: string;
  callByItemId?: Map<string, { id: string; status: string; callType: string }>;
  onResolve: (item: ReviewItem, type: string) => void;
  onAssignToAI: (item: ReviewItem, callType: string) => void;
  onStartEdit: (item: ReviewItem) => void;
  onCancelEdit: () => void;
  onEditChange: (value: string) => void;
  onSaveEdit: (item: ReviewItem) => void;
  onAssignGroup: (items: ReviewItem[], callType: string) => void;
}) {
  const [assignAllLoading, setAssignAllLoading] = useState(false);
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
  const countBg: Record<string, string> = {
    amber: "bg-amber-100 text-amber-700",
    orange: "bg-orange-100 text-orange-700",
    slate: "bg-slate-100 text-slate-600",
  };

  async function handleGroupAssignAll() {
    if (!aiCallType) return;
    setAssignAllLoading(true);
    await onAssignGroup(items, aiCallType);
    setAssignAllLoading(false);
  }

  const assignableItems = items.filter((i) => !callByItemId?.has(i.id));

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
            const isAssigning = assigning.has(item.id);
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
                    {callByItemId?.has(item.id) ? (
                      <CallStatusBadge status={callByItemId.get(item.id)!.status} />
                    ) : null}
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

                {editingId === item.id ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={editValue}
                      onChange={(e) => onEditChange(e.target.value)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      autoFocus
                    >
                      <option value="">Select clearance type…</option>
                      {resolveOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => onSaveEdit(item)}
                      disabled={isResolving || !editValue}
                      className="rounded-md bg-emerald-600 p-1 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={onCancelEdit}
                      className="rounded-md bg-slate-200 p-1 text-slate-600 hover:bg-slate-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Resolve as:</span>
                    {resolveOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={isResolving}
                        onClick={() => onResolve(item, opt.value)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                          CLEARANCE_DISPLAY[opt.value]?.bg ?? "bg-slate-100"
                        } ${CLEARANCE_DISPLAY[opt.value]?.text ?? "text-slate-600"} hover:opacity-80 disabled:opacity-50`}
                      >
                        {isResolving ? "..." : opt.label}
                      </button>
                    ))}
                    {aiCallType ? (
                      <>
                        <span className="mx-1 text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => onAssignToAI(item, aiCallType)}
                          disabled={isAssigning}
                          className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-200 disabled:opacity-50"
                        >
                          {isAssigning ? "..." : "📞 AI call"}
                        </button>
                      </>
                    ) : null}
                    <span className="mx-1 text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => onStartEdit(item)}
                      className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 hover:bg-slate-200"
                      title="Edit all fields"
                    >
                      <Pencil className="mr-0.5 inline h-3 w-3" /> Edit
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {aiCallType && assignableItems.length > 0 && (
        <div className={`border-t ${borderColors[theme]} px-5 py-3`}>
          <button
            type="button"
            disabled={assignAllLoading}
            onClick={handleGroupAssignAll}
            className="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {assignAllLoading
              ? "Assigning..."
              : `📞 Assign all ${assignableItems.length} to AI calling`
            }
          </button>
        </div>
      )}
    </div>
  );
}

function CallStatusBadge({ status }: { status: string }) {
  const style = CALL_STATUS_STYLES[status];
  if (!style) return null;
  return (
    <span className={`ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}
