import { changeOwnPassword } from "@/lib/auth";

export default async function ChangePasswordPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <section className="card w-full max-w-md overflow-hidden p-0">
        <div className="h-1 bg-primary" />
        <div className="p-6">
          <p className="text-lg font-bold text-primary">Simple Source</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Change password</h1>
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
