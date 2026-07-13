"use client";

import { useMemo, useState } from "react";

type Props = {
  initialCompanyName?: string;
  googleConfigured: boolean;
  microsoftConfigured: boolean;
};

export function RegisterOAuthButtons({
  initialCompanyName = "",
  googleConfigured,
  microsoftConfigured
}: Props) {
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const canStart = useMemo(() => companyName.trim().length > 0, [companyName]);

  if (!googleConfigured && !microsoftConfigured) {
    return null;
  }

  function href(provider: "google" | "microsoft") {
    const params = new URLSearchParams({
      mode: "register",
      companyName: companyName.trim()
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
      <div className="grid gap-2">
        {googleConfigured ? (
          <a
            href={canStart ? href("google") : undefined}
            aria-disabled={!canStart}
            className={`inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-neutral-800 ${!canStart ? "pointer-events-none opacity-50" : ""}`}
          >
            Continue with Google
          </a>
        ) : null}
        {microsoftConfigured ? (
          <a
            href={canStart ? href("microsoft") : undefined}
            aria-disabled={!canStart}
            className={`inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-neutral-800 ${!canStart ? "pointer-events-none opacity-50" : ""}`}
          >
            Continue with Microsoft 365
          </a>
        ) : null}
      </div>
      {!canStart ? (
        <p className="text-xs text-muted-foreground">Enter a company name to enable OAuth signup.</p>
      ) : null}
    </div>
  );
}
