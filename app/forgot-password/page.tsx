import Link from "next/link";
import { requestPasswordReset } from "@/lib/password-reset-actions";

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ sent?: string; devToken?: string; error?: string }>;
}) {
  const { sent, devToken, error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <section className="card w-full max-w-md overflow-hidden p-0">
        <div className="h-1 bg-primary" />
        <div className="p-6">
          <p className="text-lg font-bold text-primary">Simple Source</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Forgot password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email and we&apos;ll send a link to reset your password.
          </p>

          {error ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : null}

          {sent ? (
            <div className="mt-4 grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">Check your email</p>
              <p>
                If an account exists for that address, a reset link has been sent. It expires in 1
                hour.
              </p>
              {devToken ? (
                <div className="rounded-lg border border-border bg-card p-3 text-muted-foreground">
                  <p className="font-semibold text-foreground">Development reset link</p>
                  <p className="mt-1 text-xs">
                    Email is not required locally. Click the link below to set a new password.
                  </p>
                  <Link
                    href={`/reset-password?token=${encodeURIComponent(devToken)}`}
                    className="btn mt-3 inline-flex w-full justify-center"
                  >
                    Reset Password
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-amber-800">
                  No local reset link was generated. Use a seeded account email like{" "}
                  <span className="font-semibold">owner@example.com</span>, and make sure the
                  local app is running on{" "}
                  <span className="font-semibold">http://localhost:3000</span> (not production).
                </p>
              )}
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

          <p className="mt-5 text-sm text-muted-foreground">
            <Link href="/login" className="font-semibold text-primary">
              Back to sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
