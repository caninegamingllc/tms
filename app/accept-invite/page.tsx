import { PageHeader } from "@/components/page-header";
import { acceptInvite, getInviteByToken } from "@/lib/auth";

export default async function AcceptInvitePage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="card max-w-md text-center">
          <h1 className="text-2xl font-bold text-ink">Invalid invite link</h1>
          <p className="mt-2 text-sm text-muted">Ask your administrator to send a new invite.</p>
        </div>
      </main>
    );
  }

  const invite = await getInviteByToken(token);
  const isExistingUser = Boolean(invite?.user.passwordHash);

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="card w-full max-w-md">
        <PageHeader
          title="Accept Invite"
          description={
            isExistingUser
              ? `Join ${invite?.company.name ?? "your organization"} with your existing account.`
              : "Set a password to join your organization."
          }
        />
        {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        <form action={acceptInvite} className="mt-6 grid gap-3">
          <input type="hidden" name="token" value={token} />
          {isExistingUser ? (
            <>
              <p className="text-sm text-muted">
                Signed in as <span className="font-semibold text-ink">{invite?.user.email}</span> after accepting.
              </p>
              <input type="hidden" name="password" value="" />
              <input type="hidden" name="confirmPassword" value="" />
            </>
          ) : (
            <>
              <label className="grid gap-2">
                <span className="label">Password</span>
                <input name="password" className="input" type="password" minLength={8} required />
              </label>
              <label className="grid gap-2">
                <span className="label">Confirm password</span>
                <input name="confirmPassword" className="input" type="password" minLength={8} required />
              </label>
            </>
          )}
          <button className="btn" type="submit">
            {isExistingUser ? "Accept Invitation" : "Join Organization"}
          </button>
        </form>
      </div>
    </main>
  );
}
