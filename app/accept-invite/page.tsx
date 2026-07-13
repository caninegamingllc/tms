import { PageHeader } from "@/components/page-header";
import { OAuthButtons } from "@/components/oauth-buttons";
import { acceptInvite, getInviteByToken } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/oauth/google";
import { isMicrosoftOAuthConfigured } from "@/lib/oauth/microsoft";
import { prisma } from "@/lib/db";

export default async function AcceptInvitePage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="card max-w-md text-center">
          <p className="text-lg font-bold text-primary">Simple Source</p>
          <h1 className="mt-3 text-2xl font-bold text-foreground">Invalid invite link</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask your administrator to send a new invite.
          </p>
        </div>
      </main>
    );
  }

  const invite = await getInviteByToken(token);
  const oauthCount = invite
    ? await prisma.oAuthAccount.count({ where: { userId: invite.userId } })
    : 0;
  const isExistingUser = Boolean(invite?.user.passwordHash) || oauthCount > 0;
  const googleConfigured = isGoogleOAuthConfigured();
  const microsoftConfigured = isMicrosoftOAuthConfigured();
  const oauthAvailable = googleConfigured || microsoftConfigured;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="card w-full max-w-md overflow-hidden p-0">
        <div className="h-1 bg-primary" />
        <div className="p-6">
          <PageHeader
            title="Accept invite"
            description={
              isExistingUser
                ? `Join ${invite?.company.name ?? "your organization"} with your existing account.`
                : "Join with Google, Microsoft 365, or set a password."
            }
          />
          {error ? (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : null}

          {oauthAvailable ? (
            <div className="mt-6">
              <OAuthButtons
                mode="accept-invite"
                inviteToken={token}
                googleConfigured={googleConfigured}
                microsoftConfigured={microsoftConfigured}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Use the Google or Microsoft account for{" "}
                <span className="font-semibold text-foreground">{invite?.user.email}</span>.
              </p>
            </div>
          ) : null}

          <form action={acceptInvite} className="mt-6 grid gap-3">
            <input type="hidden" name="token" value={token} />
            {isExistingUser && invite?.user.passwordHash ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Signed in as{" "}
                  <span className="font-semibold text-foreground">{invite?.user.email}</span> after
                  accepting.
                </p>
                <input type="hidden" name="password" value="" />
                <input type="hidden" name="confirmPassword" value="" />
                <button className="btn" type="submit">
                  Accept Invitation
                </button>
              </>
            ) : (
              <>
                {oauthAvailable ? (
                  <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    Or set a password
                    <span className="h-px flex-1 bg-border" />
                  </div>
                ) : null}
                <label className="grid gap-2">
                  <span className="label">Password</span>
                  <input name="password" className="input" type="password" minLength={8} required />
                </label>
                <label className="grid gap-2">
                  <span className="label">Confirm password</span>
                  <input
                    name="confirmPassword"
                    className="input"
                    type="password"
                    minLength={8}
                    required
                  />
                </label>
                <button className="btn" type="submit">
                  Join Organization
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
