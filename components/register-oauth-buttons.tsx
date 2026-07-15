"use client";

import { useMemo, useState } from "react";
import { GoogleSignInButton, MicrosoftSignInButton } from "@/components/oauth-branded-buttons";

type Props = {
  initialCompanyName?: string;
  googleConfigured: boolean;
  microsoftConfigured: boolean;
  acceptedLegal: boolean;
};

export function RegisterOAuthButtons({
  initialCompanyName = "",
  googleConfigured,
  microsoftConfigured,
  acceptedLegal
}: Props) {
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const canStart = useMemo(
    () => companyName.trim().length > 0 && acceptedLegal,
    [companyName, acceptedLegal]
  );

  if (!googleConfigured && !microsoftConfigured) {
    return null;
  }

  function href(provider: "google" | "microsoft") {
    const params = new URLSearchParams({
      mode: "register",
      companyName: companyName.trim(),
      acceptedLegal: "1"
    });
    return `/api/auth/oauth/${provider}/start?${params.toString()}`;
  }

  return (
    <div className="mt-6 grid gap-3 rounded-lg border border-border bg-muted/40 p-4">
      <p className="text-sm font-semibold text-foreground">Create workspace with Google or Microsoft</p>
      <label className="grid gap-2">
        <span className="label">Company Name</span>
        <input
          className="input"
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          autoComplete="organization"
          placeholder="Required before continuing"
        />
      </label>
      <div className="grid gap-3">
        {googleConfigured ? (
          <GoogleSignInButton href={href("google")} disabled={!canStart}>
            Sign in with Google
          </GoogleSignInButton>
        ) : null}
        {microsoftConfigured ? (
          <MicrosoftSignInButton href={href("microsoft")} disabled={!canStart}>
            Sign in with Microsoft
          </MicrosoftSignInButton>
        ) : null}
      </div>
      {!acceptedLegal ? (
        <p className="text-xs text-muted-foreground">
          Agree to the Terms and Privacy Policy to enable OAuth signup.
        </p>
      ) : !companyName.trim() ? (
        <p className="text-xs text-muted-foreground">Enter a company name to enable OAuth signup.</p>
      ) : null}
    </div>
  );
}
