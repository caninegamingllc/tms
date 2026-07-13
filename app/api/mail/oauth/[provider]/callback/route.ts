import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { completeMailboxOAuth } from "@/lib/mail/user-mailbox";
import {
  MAIL_OAUTH_STATE_COOKIE,
  decodeOAuthState,
  parseOAuthProvider,
  type MailOAuthState
} from "@/lib/oauth/types";

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> }
) {
  const user = await requireUser();
  const { provider: rawProvider } = await context.params;
  const provider = parseOAuthProvider(rawProvider);

  if (!provider) {
    return NextResponse.redirect(new URL("/settings/email?error=Unsupported%20provider", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/settings/email?error=${encodeURIComponent(oauthError)}`, request.url)
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL("/settings/email?error=OAuth%20callback%20missing%20code%20or%20state", request.url)
    );
  }

  const cookieStore = await cookies();
  const stored = cookieStore.get(MAIL_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(MAIL_OAUTH_STATE_COOKIE);

  if (!stored || stored !== stateParam) {
    return NextResponse.redirect(new URL("/settings/email?error=Invalid%20OAuth%20state", request.url));
  }

  const decoded = decodeOAuthState(stateParam);
  if (!decoded || decoded.mode !== "mailbox") {
    return NextResponse.redirect(
      new URL("/settings/email?error=Invalid%20OAuth%20state%20payload", request.url)
    );
  }

  const state = decoded as MailOAuthState;
  if (state.provider !== provider || state.userId !== user.id) {
    return NextResponse.redirect(
      new URL("/settings/email?error=OAuth%20session%20mismatch", request.url)
    );
  }

  try {
    const email = await completeMailboxOAuth(provider, code, user.id);
    return NextResponse.redirect(
      new URL(
        `/settings/email?connected=1&email=${encodeURIComponent(email)}&provider=${provider}`,
        request.url
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mailbox connect failed";
    return NextResponse.redirect(
      new URL(`/settings/email?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
