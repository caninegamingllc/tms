import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getGoogleMailAuthorizeUrl, isGoogleOAuthConfigured } from "@/lib/oauth/google";
import { getMicrosoftMailAuthorizeUrl, isMicrosoftOAuthConfigured } from "@/lib/oauth/microsoft";
import {
  MAIL_OAUTH_STATE_COOKIE,
  encodeOAuthState,
  parseOAuthProvider,
  shouldUseSecureCookies
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

  if (provider === "GOOGLE" && !isGoogleOAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/settings/email?error=Google%20OAuth%20is%20not%20configured", request.url)
    );
  }
  if (provider === "MICROSOFT" && !isMicrosoftOAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/settings/email?error=Microsoft%20OAuth%20is%20not%20configured", request.url)
    );
  }

  const state = encodeOAuthState({
    mode: "mailbox",
    provider,
    nonce: randomBytes(16).toString("hex"),
    userId: user.id,
    returnTo: "/settings/email"
  });

  const cookieStore = await cookies();
  cookieStore.set(MAIL_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge: 60 * 15
  });

  const authorizeUrl =
    provider === "GOOGLE" ? getGoogleMailAuthorizeUrl(state) : getMicrosoftMailAuthorizeUrl(state);

  return NextResponse.redirect(authorizeUrl);
}
