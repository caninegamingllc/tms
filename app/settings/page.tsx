import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { changeOwnPasswordFromSettings, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { planHasFeature } from "@/lib/plans";

export default async function SettingsPage({
  searchParams
}: {
  searchParams: Promise<{
    error?: string;
    passwordUpdated?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true }
  });
  const hasPassword = Boolean(dbUser.passwordHash);
  const showEmailSettings = planHasFeature(user.plan, "email_mailbox");

  return (
    <>
      <PageHeader
        title="Settings"
        description="Security, appearance, and account preferences for your user."
        action={
          <Link href="/profile" className="btn-secondary">
            Profile
          </Link>
        }
      />

      {params.error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {params.error}
        </div>
      ) : null}

      {params.passwordUpdated ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          Password updated.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-display text-lg font-semibold text-foreground">Security</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Change the password used for email sign-in.
          </p>

          {hasPassword ? (
            <form action={changeOwnPasswordFromSettings} className="mt-4 grid gap-4">
              <label className="grid gap-2">
                <span className="label">Current password</span>
                <input name="currentPassword" className="input" type="password" required autoComplete="current-password" />
              </label>
              <label className="grid gap-2">
                <span className="label">New password</span>
                <input
                  name="newPassword"
                  className="input"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </label>
              <label className="grid gap-2">
                <span className="label">Confirm new password</span>
                <input
                  name="confirmPassword"
                  className="input"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </label>
              <button className="btn w-fit" type="submit">
                Update password
              </button>
            </form>
          ) : (
            <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <p>
                This account signs in with Google or Microsoft and does not have a password yet.
              </p>
              <Link href="/forgot-password" className="btn-secondary mt-3 inline-flex">
                Set a password
              </Link>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-display text-lg font-semibold text-foreground">Appearance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose light or dark mode for this browser.
          </p>
          <div className="mt-4">
            <ThemeToggle />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-lg font-semibold text-foreground">Sign-in methods</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect or review Google and Microsoft accounts linked for sign-in.
          </p>
          <Link href="/settings/account" className="btn mt-4 inline-flex">
            Manage sign-in methods
          </Link>
        </div>

        {showEmailSettings ? (
          <div className="card p-6">
            <h2 className="font-display text-lg font-semibold text-foreground">Email mailbox</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect Gmail or Microsoft 365 to send load emails and sync replies as yourself.
            </p>
            <Link href="/settings/email" className="btn mt-4 inline-flex">
              Email settings
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );
}
