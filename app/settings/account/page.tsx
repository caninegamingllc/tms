import { SettingsLayout, SettingsSectionHeading } from "@/components/settings-layout";
import { OAuthButtons } from "@/components/oauth-buttons";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isGoogleOAuthConfigured } from "@/lib/oauth/google";
import { isMicrosoftOAuthConfigured } from "@/lib/oauth/microsoft";
import { formatDateTime, humanize } from "@/lib/format";
import { getSettingsNavItems } from "@/lib/settings-nav";

export default async function AccountSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; linked?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const linkedAccounts = await prisma.oAuthAccount.findMany({
    where: { userId: user.id },
    orderBy: { provider: "asc" }
  });

  const googleConfigured = isGoogleOAuthConfigured();
  const microsoftConfigured = isMicrosoftOAuthConfigured();
  const linkedProviders = linkedAccounts.map(
    (account) => account.provider as "GOOGLE" | "MICROSOFT"
  );
  const canConnectMore =
    (googleConfigured && !linkedProviders.includes("GOOGLE")) ||
    (microsoftConfigured && !linkedProviders.includes("MICROSOFT"));

  return (
    <SettingsLayout items={getSettingsNavItems(user)}>
      <SettingsSectionHeading
        title="Account"
        description="Manage how you sign in. Connect Google or Microsoft to your existing account."
      />

      {params.error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {params.error}
        </div>
      ) : null}

      {params.linked ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          Sign-in method connected.
        </div>
      ) : null}

      <div className="card grid gap-6 p-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Your account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as <span className="font-semibold text-foreground">{user.email}</span>
            {user.name ? ` (${user.name})` : ""}.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Connected sign-in methods
          </h3>
          {linkedAccounts.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No Google or Microsoft accounts connected yet. Password sign-in still works if you set
              a password.
            </p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {linkedAccounts.map((account) => (
                <li
                  key={account.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-foreground">{humanize(account.provider)}</p>
                    <p className="text-sm text-muted-foreground">{account.email}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Linked {formatDateTime(account.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canConnectMore ? (
          <div>
            <p className="mb-3 text-sm text-muted-foreground">
              After signing in with your password (or an already-linked method), connect another
              provider here. Microsoft never auto-links by email — use this page to attach it
              safely.
            </p>
            <OAuthButtons
              mode="link"
              returnTo="/settings/account"
              googleConfigured={googleConfigured}
              microsoftConfigured={microsoftConfigured}
              hideProviders={linkedProviders}
            />
          </div>
        ) : googleConfigured || microsoftConfigured ? (
          <p className="text-sm text-muted-foreground">
            All available sign-in providers are already connected.
          </p>
        ) : (
          <p className="text-sm text-amber-700">
            Google and Microsoft sign-in are not configured on this server.
          </p>
        )}
      </div>
    </SettingsLayout>
  );
}
