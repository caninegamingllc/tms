import Link from "next/link";
import { registerCompany } from "@/lib/auth";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <section className="card w-full max-w-lg overflow-hidden p-0">
        <div className="h-1 bg-primary" />
        <div className="p-6">
          <p className="text-lg font-bold text-primary">Simple Source</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Create your company</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Start a separate TMS workspace for your brokerage. Your customers, carriers, loads,
            documents, and accounting records stay isolated from other companies.
          </p>

          {error ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : null}

          <form action={registerCompany} className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="label">Company Name</span>
              <input name="companyName" className="input" autoComplete="organization" required />
            </label>
            <label className="grid gap-2">
              <span className="label">Your Name</span>
              <input name="name" className="input" autoComplete="name" required />
            </label>
            <label className="grid gap-2">
              <span className="label">Email</span>
              <input name="email" className="input" type="email" autoComplete="email" required />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="label">Password</span>
                <input
                  name="password"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
              <label className="grid gap-2">
                <span className="label">Confirm Password</span>
                <input
                  name="confirmPassword"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
            </div>
            <button className="btn" type="submit">
              Create Workspace
            </button>
          </form>

          <p className="mt-5 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
