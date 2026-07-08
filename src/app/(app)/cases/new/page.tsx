import { createTestCase } from "./actions";

export default async function NewTestCasePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold text-slate-900">
        Create test case
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Admin-only utility for exercising the claim/assign/release workflow
        before any batch has been sent.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <form action={createTestCase} className="mt-6 space-y-4">
        <div>
          <label htmlFor="awb" className="block text-sm font-medium text-slate-700">
            AWB
          </label>
          <input
            id="awb"
            name="awb"
            type="text"
            required
            placeholder="176-12345678"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Create case
        </button>
      </form>
    </div>
  );
}
