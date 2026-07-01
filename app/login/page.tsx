import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, login } from "@/lib/auth";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.mustChangePassword ? "/change-password" : "/");
  }

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="card w-full max-w-md">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Broker OS</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Sign In</h1>
        <p className="mt-2 text-sm text-muted">
          Use your TMS account to access loads, dispatch, accounting, reports, and admin tools.
        </p>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        <form action={login} className="mt-6 grid gap-4">
          <label className="grid gap-2">
            <span className="label">Email</span>
            <input name="email" className="input" type="email" autoComplete="email" required />
          </label>
          <label className="grid gap-2">
            <span className="label">Password</span>
            <input
              name="password"
              className="input"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="btn" type="submit">
            Sign In
          </button>
        </form>

        <div className="mt-5 rounded-2xl bg-soft p-4 text-sm text-slate-700">
          <p className="font-semibold text-ink">Development Login</p>
          <p>Email: owner@example.com</p>
          <p>Password: ChangeMe123!</p>
        </div>

        <p className="mt-5 text-sm text-muted">
          New brokerage?{" "}
          <Link href="/register" className="font-semibold text-brand-700">
            Create a company workspace
          </Link>
        </p>
      </section>
    </main>
  );
}
