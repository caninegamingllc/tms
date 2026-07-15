import { PageHeader } from "@/components/page-header";
import { AcceptInviteForm } from "@/components/accept-invite-form";
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
          <p className="font-display text-lg font-semibold text-primary">Simple Source</p>
          <h1 className="mt-3 font-display text-2xl font-semibold text-foreground">Invalid invite link</h1>
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

          <AcceptInviteForm
            token={token}
            inviteEmail={invite?.user.email}
            isExistingUser={isExistingUser}
            hasPassword={Boolean(invite?.user.passwordHash)}
            googleConfigured={googleConfigured}
            microsoftConfigured={microsoftConfigured}
            acceptAction={acceptInvite}
          />
        </div>
      </div>
    </main>
  );
}
