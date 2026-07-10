import Link from "next/link";
import { resetPassword } from "@/lib/password-reset-actions";

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="card max-w-md text-center">
          <h1 className="text-2xl font-bold text-ink">Invalid reset link</h1>
          <p className="mt-2 text-sm text-muted">Request a new password reset from the sign-in page.</p>
          <Link href="/forgot-password" className="btn mt-4 inline-flex">
            Forgot password
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="card w-full max-w-md">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Broker OS</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Reset Password</h1>
        <p className="mt-2 text-sm text-muted">Choose a new password for your account.</p>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        <form action={resetPassword} className="mt-6 grid gap-4">
          <input type="hidden" name="token" value={token} />
          <label className="grid gap-2">
            <span className="label">New password</span>
            <input name="password" className="input" type="password" minLength={8} required />
          </label>
          <label className="grid gap-2">
            <span className="label">Confirm password</span>
            <input name="confirmPassword" className="input" type="password" minLength={8} required />
          </label>
          <button className="btn" type="submit">
            Update Password
          </button>
        </form>

        <p className="mt-5 text-sm text-muted">
          <Link href="/login" className="font-semibold text-brand-700">
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
