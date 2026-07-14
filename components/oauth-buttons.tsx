import Link from "next/link";

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
      <div className="grid gap-2">
        {googleConfigured ? (
          <Link
            href={href("google")}
            className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-center text-sm font-semibold text-red-500 transition hover:bg-neutral-800 [text-shadow:-1px_-1px_0_#fff,1px_-1px_0_#fff,-1px_1px_0_#fff,1px_1px_0_#fff]"
          >
            Continue with Google
          </Link>
        ) : null}
        {microsoftConfigured ? (
          <Link
            href={href("microsoft")}
            className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-center text-sm font-semibold text-red-500 transition hover:bg-neutral-800 [text-shadow:-1px_-1px_0_#fff,1px_-1px_0_#fff,-1px_1px_0_#fff,1px_1px_0_#fff]"
          >
            Continue with Microsoft 365
          </Link>
        ) : null}
      </div>
    </div>
  );
}
