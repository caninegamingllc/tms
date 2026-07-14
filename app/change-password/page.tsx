import { AuthBrandPanel, AuthMobileBrand } from "@/components/auth-brand-panel";
import { changeOwnPassword } from "@/lib/auth";

export default async function ChangePasswordPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[1.15fr_1fr]">
      <AuthBrandPanel />
      <section className="flex items-center justify-center px-6 py-10 lg:px-16">
        <div className="w-full max-w-md">
          <AuthMobileBrand />
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Security
          </p>
          <h1 className="font-display mt-1 text-[2rem] font-semibold tracking-tight text-foreground">
            Change password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your administrator requires a password change before you continue.
          </p>

          {error ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : null}

          <form action={changeOwnPassword} className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="label">Current Password</span>
              <input name="currentPassword" className="input" type="password" required />
            </label>
            <label className="grid gap-2">
              <span className="label">New Password</span>
              <input name="newPassword" className="input" type="password" minLength={8} required />
            </label>
            <label className="grid gap-2">
              <span className="label">Confirm New Password</span>
              <input name="confirmPassword" className="input" type="password" minLength={8} required />
            </label>
            <button className="btn" type="submit">
              Save Password
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
