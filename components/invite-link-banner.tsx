"use client";

export function InviteLinkBanner({ invitePath }: { invitePath: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = `${origin}${invitePath}`;

  return (
    <div className="card mb-6 border-brand-200 bg-brand-50">
      <h2 className="section-title">Invite link ready</h2>
      <p className="muted">Share this link with the new user. It expires in 7 days.</p>
      <div className="mt-3 flex flex-col gap-3 md:flex-row">
        <input className="input flex-1" readOnly value={inviteUrl} />
        <button
          className="btn-secondary"
          type="button"
          onClick={() => navigator.clipboard.writeText(inviteUrl)}
        >
          Copy Link
        </button>
      </div>
    </div>
  );
}
