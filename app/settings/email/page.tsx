import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { TileBoard, Tile } from "@/components/tile-board";
import { requireUser } from "@/lib/auth";
import { requirePlanFeature } from "@/lib/permissions";
import { disconnectMailbox, syncMyMailbox } from "@/lib/mail-actions";
import { listUserMailboxes } from "@/lib/mail/user-mailbox";
import { isGoogleOAuthConfigured } from "@/lib/oauth/google";
import { isMicrosoftOAuthConfigured } from "@/lib/oauth/microsoft";
import { formatDateTime, humanize } from "@/lib/format";
import { SETTINGS_EMAIL_TILES } from "@/lib/tile-defaults";
import { loadPageLayouts } from "@/lib/ui-preferences-load";

export default async function EmailSettingsPage({
  searchParams
}: {
  searchParams: Promise<{
    error?: string;
    connected?: string;
    email?: string;
    provider?: string;
  }>;
}) {
  await requirePlanFeature("email_mailbox");
  const user = await requireUser();
  const params = await searchParams;
  const [mailboxes, layouts] = await Promise.all([
    listUserMailboxes(user.id),
    loadPageLayouts("settings-email")
  ]);
  const googleConfigured = isGoogleOAuthConfigured();
  const microsoftConfigured = isMicrosoftOAuthConfigured();

  return (
    <>
      <PageHeader
        title="Email settings"
        description="Connect your personal Gmail or Microsoft 365 mailbox to send load emails and sync replies as yourself."
      />

      {params.error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {params.error}
        </div>
      ) : null}

      {params.connected ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          Connected {params.provider ? humanize(params.provider) : "mailbox"}
          {params.email ? ` (${params.email})` : ""}.
        </div>
      ) : null}

      <TileBoard pageId="settings-email" tiles={SETTINGS_EMAIL_TILES} initialLayouts={layouts}>
        <Tile id="gmail">
          <p className="muted">Send and sync using your Google Workspace or Gmail account.</p>
          {googleConfigured ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/api/mail/oauth/google/start" className="btn">
                Connect Gmail
              </Link>
            </div>
          ) : (
            <p className="mt-4 text-sm text-amber-700">Google OAuth is not configured on this server.</p>
          )}
        </Tile>

        <Tile id="microsoft">
          <p className="muted">Send and sync using your Outlook / Microsoft 365 mailbox.</p>
          {microsoftConfigured ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/api/mail/oauth/microsoft/start" className="btn">
                Connect Outlook
              </Link>
            </div>
          ) : (
            <p className="mt-4 text-sm text-amber-700">
              Microsoft OAuth is not configured on this server.
            </p>
          )}
        </Tile>

        <Tile id="mailboxes">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="muted">Mailboxes connected to your user account.</p>
            <form action={syncMyMailbox}>
              <button type="submit" className="btn-secondary">
                Sync replies now
              </button>
            </form>
          </div>

          {mailboxes.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No mailbox connected yet.</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {mailboxes.map((mailbox) => (
                <li
                  key={mailbox.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {humanize(mailbox.provider)} · {mailbox.emailAddress}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Status: {mailbox.status}
                      {mailbox.lastSyncAt ? ` · Last sync ${formatDateTime(mailbox.lastSyncAt)}` : ""}
                    </p>
                    {mailbox.lastError ? (
                      <p className="text-sm text-rose-700">{mailbox.lastError}</p>
                    ) : null}
                  </div>
                  <form action={disconnectMailbox}>
                    <input type="hidden" name="provider" value={mailbox.provider} />
                    <button type="submit" className="btn-secondary">
                      Disconnect
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Tile>
      </TileBoard>
    </>
  );
}
