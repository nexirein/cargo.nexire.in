import Link from "next/link";
import { requestPasswordReset } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">
          Reset your password
        </h1>

        {sent ? (
          <>
            <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              If that email has an account, a reset link is on its way.
            </p>
            <Link
              href="/login"
              className="mt-6 block text-center text-sm text-slate-500 hover:text-slate-700"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-500">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            ) : null}

            <form action={requestPasswordReset} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Send reset link
              </button>
            </form>

            <Link
              href="/login"
              className="mt-4 block text-center text-sm text-slate-500 hover:text-slate-700"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
