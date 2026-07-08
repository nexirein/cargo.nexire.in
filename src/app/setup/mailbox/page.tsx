import { saveMailboxConfig } from "./actions";

export default async function MailboxSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">
          Set up your mailbox
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Before you can send pre-alerts, tell us which mailbox you send from
          and which mailbox should be CC&apos;d on every pre-alert to catch
          replies.
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        <form action={saveMailboxConfig} className="mt-6 space-y-4">
          <Field
            id="displayName"
            name="displayName"
            label="Display name"
            placeholder="e.g. Mumbai Cargo Ops"
            required
          />
          <Field
            id="operationalMailbox"
            name="operationalMailbox"
            label="Operational mailbox (sends from)"
            type="email"
            placeholder="cargo-ops@yourcompany.com"
            required
          />
          <Field
            id="taggedMailbox"
            name="taggedMailbox"
            label="Tagged/CC mailbox (monitors replies)"
            type="email"
            placeholder="prealert-replies@yourcompany.com"
            required
          />
          <div>
            <label
              htmlFor="timezone"
              className="block text-sm font-medium text-slate-700"
            >
              Timezone
            </label>
            <select
              id="timezone"
              name="timezone"
              defaultValue="Asia/Kolkata"
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="Asia/Kolkata">Asia/Kolkata</option>
              <option value="Asia/Dubai">Asia/Dubai</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="signatureHtml"
              className="block text-sm font-medium text-slate-700"
            >
              Signature (optional)
            </label>
            <textarea
              id="signatureHtml"
              name="signatureHtml"
              rows={3}
              placeholder={"Regards,\nCargo Operations Team"}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Save and continue
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  id,
  name,
  label,
  type = "text",
  placeholder,
  required,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />
    </div>
  );
}
