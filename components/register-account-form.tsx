"use client";

import { useState } from "react";
import { LegalAcceptanceCheckbox } from "@/components/legal-acceptance-checkbox";
import { RegisterOAuthButtons } from "@/components/register-oauth-buttons";

type Props = {
  googleConfigured: boolean;
  microsoftConfigured: boolean;
  registerAction: (formData: FormData) => void | Promise<void>;
};

export function RegisterAccountForm({
  googleConfigured,
  microsoftConfigured,
  registerAction
}: Props) {
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  return (
    <>
      <div className="mt-6">
        <LegalAcceptanceCheckbox checked={acceptedLegal} onChange={setAcceptedLegal} />
      </div>

      <RegisterOAuthButtons
        googleConfigured={googleConfigured}
        microsoftConfigured={microsoftConfigured}
        acceptedLegal={acceptedLegal}
      />

      <form action={registerAction} className="mt-6 grid gap-4">
        {acceptedLegal ? <input type="hidden" name="acceptedLegal" value="on" /> : null}
        <label className="grid gap-2">
          <span className="label">Company Name</span>
          <input name="companyName" className="input" autoComplete="organization" required />
        </label>
        <label className="grid gap-2">
          <span className="label">Your Name</span>
          <input name="name" className="input" autoComplete="name" required />
        </label>
        <label className="grid gap-2">
          <span className="label">Email</span>
          <input name="email" className="input" type="email" autoComplete="email" required />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="label">Password</span>
            <input
              name="password"
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="label">Confirm Password</span>
            <input
              name="confirmPassword"
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
        </div>
        <button className="btn" type="submit" disabled={!acceptedLegal}>
          Create Workspace
        </button>
      </form>
    </>
  );
}
