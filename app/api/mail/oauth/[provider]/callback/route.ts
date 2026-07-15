import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { appAbsoluteUrl, requestPublicOrigin } from "@/lib/app-url";
import { requireUser } from "@/lib/auth";
import { completeMailboxOAuth } from "@/lib/mail/user-mailbox";
import {
  MAIL_OAUTH_STATE_COOKIE,
  decodeOAuthState,
  parseOAuthProvider,
  type MailOAuthState
} from "@/lib/oauth/types";

function emailSettingsRedirect(request: Request, pathWithQuery: string) {
  return NextResponse.redirect(appAbsoluteUrl(pathWithQuery, request));
}

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await context.params;
  const provider = parseOAuthProvider(rawProvider);
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");

  // Handle Microsoft/Google cancel before session checks. Cancel can land on a
  // leftover localhost reply URL where the production session cookie is absent.
  if (oauthError) {
    return emailSettingsRedirect(
      request,
      `/settings/email?error=${encodeURIComponent(oauthError)}`
    );
  }

  if (!provider) {
    return emailSettingsRedirect(request, "/settings/email?error=Unsupported%20provider");
  }

  const user = await requireUser();
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  if (!code || !stateParam) {
    return emailSettingsRedirect(
      request,
      "/settings/email?error=OAuth%20callback%20missing%20code%20or%20state"
    );
  }

  const cookieStore = await cookies();
  const stored = cookieStore.get(MAIL_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(MAIL_OAUTH_STATE_COOKIE);

  if (!stored || stored !== stateParam) {
    return emailSettingsRedirect(request, "/settings/email?error=Invalid%20OAuth%20state");
  }

  const decoded = decodeOAuthState(stateParam);
  if (!decoded || decoded.mode !== "mailbox") {
    return emailSettingsRedirect(
      request,
      "/settings/email?error=Invalid%20OAuth%20state%20payload"
    );
  }

  const state = decoded as MailOAuthState;
  if (state.provider !== provider || state.userId !== user.id) {
    return emailSettingsRedirect(request, "/settings/email?error=OAuth%20session%20mismatch");
  }

  try {
    const email = await completeMailboxOAuth(
      provider,
      code,
      user.id,
      requestPublicOrigin(request)
    );
    return emailSettingsRedirect(
      request,
      `/settings/email?connected=1&email=${encodeURIComponent(email)}&provider=${provider}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mailbox connect failed";
    return emailSettingsRedirect(
      request,
      `/settings/email?error=${encodeURIComponent(message)}`
    );
  }
}
