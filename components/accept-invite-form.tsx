"use client";

import { useState } from "react";
import { OAuthButtons } from "@/components/oauth-buttons";
import { LegalAcceptanceCheckbox } from "@/components/legal-acceptance-checkbox";

type Props = {
  token: string;
  inviteEmail?: string;
  isExistingUser: boolean;
  hasPassword: boolean;
  googleConfigured: boolean;
  microsoftConfigured: boolean;
  acceptAction: (formData: FormData) => void | Promise<void>;
};

export function AcceptInviteForm({
  token,
  inviteEmail,
  isExistingUser,
  hasPassword,
  googleConfigured,
  microsoftConfigured,
  acceptAction
}: Props) {
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const oauthAvailable = googleConfigured || microsoftConfigured;

  return (
    <>
      <div className="mt-6">
        <LegalAcceptanceCheckbox checked={acceptedLegal} onChange={setAcceptedLegal} />
      </div>

      {oauthAvailable ? (
        <div className="mt-6">
          <OAuthButtons
            mode="accept-invite"
            inviteToken={token}
            acceptedLegal={acceptedLegal}
            googleConfigured={googleConfigured}
            microsoftConfigured={microsoftConfigured}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Use the Google or Microsoft account for{" "}
            <span className="font-semibold text-foreground">{inviteEmail}</span>.
          </p>
          {!acceptedLegal ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Agree to the Terms and Privacy Policy to enable OAuth.
            </p>
          ) : null}
        </div>
      ) : null}

      <form action={acceptAction} className="mt-6 grid gap-3">
        <input type="hidden" name="token" value={token} />
        {acceptedLegal ? <input type="hidden" name="acceptedLegal" value="on" /> : null}
        {isExistingUser && hasPassword ? (
          <>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-semibold text-foreground">{inviteEmail}</span> after
              accepting.
            </p>
            <input type="hidden" name="password" value="" />
            <input type="hidden" name="confirmPassword" value="" />
            <button className="btn" type="submit" disabled={!acceptedLegal}>
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
            <button className="btn" type="submit" disabled={!acceptedLegal}>
              Join Organization
            </button>
          </>
        )}
      </form>
    </>
  );
}
