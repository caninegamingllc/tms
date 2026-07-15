import { redirect } from "next/navigation";
import { getPortalViewer, portalAcceptInvite } from "@/lib/portal-auth";
import { prisma } from "@/lib/db";
import { createHash } from "crypto";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export default async function PortalAcceptInvitePage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const viewer = await getPortalViewer();
  if (viewer) {
    redirect("/portal");
  }

  const { token, error } = await searchParams;
  const invite =
    token != null && token.length > 0
      ? await prisma.customerPortalUser.findFirst({
          where: {
            inviteTokenHash: hashToken(token),
            status: "INVITED",
            disabledAt: null
          },
          include: {
            customer: { select: { name: true } },
            company: { select: { name: true } }
          }
        })
      : null;

  const expired =
    invite != null && (!invite.inviteExpiresAt || invite.inviteExpiresAt < new Date());

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Customer portal
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">Accept invite</h1>
        {invite && !expired ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Set a password to access {invite.customer.name} shipments from {invite.company.name}.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            This invite link is missing, invalid, or expired.
          </p>
        )}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {invite && !expired && token ? (
          <form action={portalAcceptInvite} className="mt-6 grid gap-3">
            <input type="hidden" name="token" value={token} />
            <label className="grid gap-2">
              <span className="label">Name</span>
              <input name="name" className="input" defaultValue={invite.name} required />
            </label>
            <label className="grid gap-2">
              <span className="label">Email</span>
              <input className="input" value={invite.email} disabled readOnly />
            </label>
            <label className="grid gap-2">
              <span className="label">Password</span>
              <input name="password" type="password" className="input" required minLength={8} />
            </label>
            <label className="grid gap-2">
              <span className="label">Confirm password</span>
              <input name="confirmPassword" type="password" className="input" required minLength={8} />
            </label>
            <button type="submit" className="btn mt-2">
              Activate account
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
