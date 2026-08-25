"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ArrowLeft, AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";

interface BrokerRule {
  id: string;
  company_name: string;
  company_name_normalized: string;
  broker_type: string;
  broker_name: string | null;
  match_type: "exact" | "pattern";
  source: string;
  confirmed_count: number;
  last_used_at: string | null;
}

const BROKER_TYPE_OPTIONS = [
  { value: "febrk-jeena", label: "FEBRK-Jeena" },
  { value: "febrk-sunimpex", label: "FEBRK-Sunimpex" },
];

const MATCH_TYPE_OPTIONS = [
  { value: "exact", label: "Exact match" },
  { value: "pattern", label: "Pattern (contains)" },
];

export default function BrokerRulesPage() {
  const [rules, setRules] = useState<BrokerRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BrokerRule | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ company_name: "", broker_type: "febrk-jeena", broker_name: "", match_type: "exact" as "exact" | "pattern" });

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clearance-fill/broker-rules");
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to fetch");
      const data = await res.json();
      setRules(data.rules ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const openAdd = () => {
    setEditing(null);
    setForm({ company_name: "", broker_type: "febrk-jeena", broker_name: "", match_type: "exact" });
    setShowModal(true);
  };

  const openEdit = (rule: BrokerRule) => {
    setEditing(rule);
    setForm({ company_name: rule.company_name, broker_type: rule.broker_type, broker_name: rule.broker_name ?? "", match_type: rule.match_type });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.company_name.trim() || !form.broker_name.trim()) return;
    setSaving(true);
    try {
      const url = editing
        ? `/api/clearance-fill/broker-rules/${editing.id}`
        : "/api/clearance-fill/broker-rules";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      setShowModal(false);
      fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/clearance-fill/broker-rules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to delete");
      setDeleting(null);
      fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link href="/clearance-fill" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Clearance Fill
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Broker Override Rules</h1>
            <p className="mt-1 text-sm text-slate-500">
              Pattern-based rules (like AIR INDIA → HC khanna) and exact company→broker mappings.
              Rules with <strong>Pattern</strong> match company names containing the text (case-insensitive).
            </p>
          </div>
          <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">
            <Plus className="h-4 w-4" />Add Rule
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" />Loading rules...
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 py-12 text-center">
          <p className="text-slate-500">No broker rules yet.</p>
          <button onClick={openAdd} className="mt-3 text-sm font-medium text-violet-600 hover:text-violet-700">Add your first rule</button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Match Type</th>
                <th className="px-4 py-3">Broker Type</th>
                <th className="px-4 py-3">Broker Name</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Confirmed</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{rule.company_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      rule.match_type === "pattern" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {rule.match_type === "pattern" ? "Pattern" : "Exact"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{rule.broker_type}</td>
                  <td className="px-4 py-3 text-slate-700">{rule.broker_name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{rule.source}</td>
                  <td className="px-4 py-3 text-slate-700">{rule.confirmed_count}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => openEdit(rule)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleting(rule.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => !saving && setShowModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900">{editing ? "Edit Rule" : "Add Rule"}</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Company Name</label>
                <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="e.g., AIR INDIA" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Match Type</label>
                <select value={form.match_type} onChange={(e) => setForm({ ...form, match_type: e.target.value as "exact" | "pattern" })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500">
                  {MATCH_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {form.match_type === "pattern" && (
                  <p className="mt-1 text-xs text-amber-600">Matches any company name containing this text (case-insensitive).</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Broker Type</label>
                <select value={form.broker_type} onChange={(e) => setForm({ ...form, broker_type: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500">
                  {BROKER_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Broker Name</label>
                <input value={form.broker_name} onChange={(e) => setForm({ ...form, broker_name: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="e.g., HC khanna" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !form.company_name.trim() || !form.broker_name.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60">
                {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
                {editing ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => !saving && setDeleting(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900">Delete Rule?</h2>
            <p className="mt-2 text-sm text-slate-500">This cannot be undone. Auto-fill will no longer use this rule.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDeleting(null)} disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleting)} disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
