import Link from "next/link";
import { createHash } from "crypto";
import { portalAcceptInvite } from "@/lib/portal-auth-actions";
import { getPortalViewer } from "@/lib/portal-auth";
import { prisma } from "@/lib/db";
import { PortalAcceptInviteForm } from "@/components/portal-accept-invite-form";
import { redirect } from "next/navigation";

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
  let invite: Awaited<ReturnType<typeof loadInvite>> = null;
  let lookupError: string | null = null;

  try {
    invite = token ? await loadInvite(token) : null;
  } catch {
    lookupError = "We could not look up this invite right now. Please try again in a moment.";
  }

  const expired =
    invite != null && (!invite.inviteExpiresAt || invite.inviteExpiresAt < new Date());
  const usable = Boolean(invite && !expired && token);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Customer portal
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">Accept invite</h1>

        {usable && invite ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Set a password to access {invite.customer.name} shipments from {invite.company.name}.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {lookupError ??
              "This invite link is missing, invalid, or expired. If a newer invite was sent, only the latest link works. Ask your broker to send a fresh portal invite."}
          </p>
        )}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {usable && invite && token ? (
          <PortalAcceptInviteForm
            token={token}
            name={invite.name}
            email={invite.email}
            acceptAction={portalAcceptInvite}
          />
        ) : (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already activated?{" "}
            <Link href="/portal/login" className="font-semibold text-primary">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}

async function loadInvite(token: string) {
  return prisma.customerPortalUser.findFirst({
    where: {
      inviteTokenHash: hashToken(token),
      status: "INVITED",
      disabledAt: null
    },
    include: {
      customer: { select: { name: true } },
      company: { select: { name: true } }
    }
  });
}
