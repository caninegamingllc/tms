import Link from "next/link";
import { requestPasswordReset } from "@/lib/password-reset-actions";

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ sent?: string; devToken?: string; error?: string }>;
}) {
  const { sent, devToken, error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="card w-full max-w-md">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Broker OS</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Forgot Password</h1>
        <p className="mt-2 text-sm text-muted">
          Enter your email and we&apos;ll send a link to reset your password.
        </p>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        {sent ? (
          <div className="mt-4 grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-semibold">Check your email</p>
            <p>
              If an account exists for that address, a reset link has been sent. It expires in 1
              hour.
            </p>
            {devToken ? (
              <div className="rounded-xl bg-white p-3 text-slate-700">
                <p className="font-semibold text-ink">Development reset link</p>
                <Link
                  href={`/reset-password?token=${encodeURIComponent(devToken)}`}
                  className="mt-2 block break-all font-semibold text-brand-700"
                >
                  /reset-password?token={devToken.slice(0, 8)}...
                </Link>
              </div>
            ) : null}
          </div>
        ) : (
          <form action={requestPasswordReset} className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="label">Email</span>
              <input name="email" className="input" type="email" autoComplete="email" required />
            </label>
            <button className="btn" type="submit">
              Send Reset Link
            </button>
          </form>
        )}

        <p className="mt-5 text-sm text-muted">
          <Link href="/login" className="font-semibold text-brand-700">
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
