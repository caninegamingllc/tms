import { GoogleSignInButton, MicrosoftSignInButton } from "@/components/oauth-branded-buttons";

type Props = {
  mode: "login" | "register" | "accept-invite";
  companyName?: string;
  inviteToken?: string;
  acceptedLegal?: boolean;
  googleConfigured: boolean;
  microsoftConfigured: boolean;
};

export function OAuthButtons({
  mode,
  companyName,
  inviteToken,
  acceptedLegal = true,
  googleConfigured,
  microsoftConfigured
}: Props) {
  if (!googleConfigured && !microsoftConfigured) {
    return null;
  }

  const requiresLegal = mode === "register" || mode === "accept-invite";
  const canStart = !requiresLegal || acceptedLegal;

  function href(provider: "google" | "microsoft") {
    const params = new URLSearchParams({ mode });
    if (companyName) {
      params.set("companyName", companyName);
    }
    if (inviteToken) {
      params.set("inviteToken", inviteToken);
    }
    if (requiresLegal && acceptedLegal) {
      params.set("acceptedLegal", "1");
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
    </div>
  );
}
