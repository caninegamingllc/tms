import { GoogleSignInButton, MicrosoftSignInButton } from "@/components/oauth-branded-buttons";

type Props = {
  mode: "login" | "register" | "accept-invite";
  companyName?: string;
  inviteToken?: string;
  googleConfigured: boolean;
  microsoftConfigured: boolean;
};

export function OAuthButtons({
  mode,
  companyName,
  inviteToken,
  googleConfigured,
  microsoftConfigured
}: Props) {
  if (!googleConfigured && !microsoftConfigured) {
    return null;
  }

  function href(provider: "google" | "microsoft") {
    const params = new URLSearchParams({ mode });
    if (companyName) {
      params.set("companyName", companyName);
    }
    if (inviteToken) {
      params.set("inviteToken", inviteToken);
    }
    return `/api/auth/oauth/${provider}/start?${params.toString()}`;
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        Or continue with
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-3">
        {googleConfigured ? (
          <GoogleSignInButton href={href("google")}>Sign in with Google</GoogleSignInButton>
        ) : null}
        {microsoftConfigured ? (
          <MicrosoftSignInButton href={href("microsoft")}>Sign in with Microsoft</MicrosoftSignInButton>
        ) : null}
      </div>
    </div>
  );
}
