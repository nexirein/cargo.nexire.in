"use client";

import { useState } from "react";
import { createBatch } from "./actions";

interface Mailbox {
  id: string;
  display_name: string | null;
  operational_mailbox: string;
}

interface Template {
  id: string;
  name: string;
  type: string;
}

export function BatchForm({ mailboxes, templates, initialName }: { mailboxes: Mailbox[]; templates: Template[]; initialName: string }) {
  const [preAlertType, setPreAlertType] = useState("u_bond");

  const suggestedName = preAlertType === "consol"
    ? initialName.replace(/^UBOND-/, "CONSOL-")
    : initialName.replace(/^CONSOL-/, "UBOND-");

  return (
    <form action={createBatch} className="mt-6 space-y-5">
      <div>
        <label htmlFor="runName" className="block text-sm font-medium text-slate-700">
          Run name
        </label>
        <input
          id="runName"
          name="runName"
          type="text"
          required
          defaultValue={suggestedName}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <p className="mt-1 text-xs text-slate-400">
          Suggested format: UBOND-YYYY-MM-DD-AM/PM or CONSOL-YYYY-MM-DD-AM/PM — feel free to change it.
        </p>
      </div>

      <div>
        <label htmlFor="phase" className="block text-sm font-medium text-slate-700">
          Batch phase
        </label>
        <select
          id="phase"
          name="phase"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="pre_alert">Pre-alert (send clearance notification)</option>
          <option value="post_arrival">Post-arrival (cargo arrival notice)</option>
          <option value="tp_hold">TP Hold (update hold status — no email)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Pre-alert type
        </label>
        <p className="mt-0.5 text-xs text-slate-400">
          uBond = prior data (2-3x daily). Consol = post-IGM (final, same-day).
        </p>
        <div className="mt-2 flex gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="preAlertType"
              value="u_bond"
              checked={preAlertType === "u_bond"}
              onChange={() => setPreAlertType("u_bond")}
              className="text-slate-900 focus:ring-slate-500"
            />
            uBond
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="preAlertType"
              value="consol"
              checked={preAlertType === "consol"}
              onChange={() => setPreAlertType("consol")}
              className="text-slate-900 focus:ring-slate-500"
            />
            Consol
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="mailboxConfigId" className="block text-sm font-medium text-slate-700">
          Send from mailbox
        </label>
        <select
          id="mailboxConfigId"
          name="mailboxConfigId"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">Select a mailbox…</option>
          {mailboxes.map((mailbox) => (
            <option key={mailbox.id} value={mailbox.id}>
              {mailbox.display_name} ({mailbox.operational_mailbox})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="templateId" className="block text-sm font-medium text-slate-700">
          Email template
        </label>
        <select
          id="templateId"
          name="templateId"
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">Auto-detect from End Result column</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">
          Leave blank to auto-detect from the Excel End Result column.
        </p>
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-slate-700">
          Sub-batch size
        </legend>
        <p className="mt-1 text-xs text-slate-400">
          Rows are split into sub-batches for progress tracking and retries.
        </p>
        <div className="mt-2 flex gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="subBatchSize"
              value={25}
              defaultChecked
              className="text-slate-900 focus:ring-slate-500"
            />
            25 per sub-batch (default)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="subBatchSize"
              value={50}
              className="text-slate-900 focus:ring-slate-500"
            />
            50 per sub-batch
          </label>
        </div>
      </fieldset>

      <button
        type="submit"
        className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Create and continue
      </button>
    </form>
  );
}
