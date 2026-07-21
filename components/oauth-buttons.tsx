import { GoogleSignInButton, MicrosoftSignInButton } from "@/components/oauth-branded-buttons";

type Props = {
  mode: "login" | "register" | "accept-invite" | "link";
  companyName?: string;
  inviteToken?: string;
  returnTo?: string;
  acceptedLegal?: boolean;
  googleConfigured: boolean;
  microsoftConfigured: boolean;
  /** Hide providers that are already linked (link mode). */
  hideProviders?: Array<"GOOGLE" | "MICROSOFT">;
};

export function OAuthButtons({
  mode,
  companyName,
  inviteToken,
  returnTo,
  acceptedLegal = true,
  googleConfigured,
  microsoftConfigured,
  hideProviders = []
}: Props) {
  const showGoogle = googleConfigured && !hideProviders.includes("GOOGLE");
  const showMicrosoft = microsoftConfigured && !hideProviders.includes("MICROSOFT");

  if (!showGoogle && !showMicrosoft) {
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
    if (returnTo) {
      params.set("returnTo", returnTo);
    }
    if (requiresLegal && acceptedLegal) {
      params.set("acceptedLegal", "1");
    }
    return `/api/auth/oauth/${provider}/start?${params.toString()}`;
  }

  const dividerLabel =
    mode === "link" ? "Connect a sign-in method" : "Or continue with";
  const googleLabel = mode === "link" ? "Connect Google" : "Sign in with Google";
  const microsoftLabel = mode === "link" ? "Connect Microsoft" : "Sign in with Microsoft";

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {dividerLabel}
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-3">
        {showGoogle ? (
          <GoogleSignInButton href={href("google")} disabled={!canStart}>
            {googleLabel}
          </GoogleSignInButton>
        ) : null}
        {showMicrosoft ? (
          <MicrosoftSignInButton href={href("microsoft")} disabled={!canStart}>
            {microsoftLabel}
          </MicrosoftSignInButton>
        ) : null}
      </div>
    </div>
  );
}
