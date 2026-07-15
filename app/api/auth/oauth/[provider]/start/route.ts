import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requestPublicOrigin } from "@/lib/app-url";
import { getGoogleIdentityAuthorizeUrl, isGoogleOAuthConfigured } from "@/lib/oauth/google";
import { getMicrosoftIdentityAuthorizeUrl, isMicrosoftOAuthConfigured } from "@/lib/oauth/microsoft";
import {
  IDENTITY_OAUTH_STATE_COOKIE,
  encodeOAuthState,
  parseOAuthProvider,
  shouldUseSecureCookies,
  type IdentityOAuthMode
} from "@/lib/oauth/types";

function errorRedirect(request: Request, path: string, message: string) {
  const url = new URL(path, request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await context.params;
  const provider = parseOAuthProvider(rawProvider);
  if (!provider) {
    return errorRedirect(request, "/login", "Unsupported OAuth provider");
  }

  if (provider === "GOOGLE" && !isGoogleOAuthConfigured()) {
    return errorRedirect(request, "/login", "Google sign-in is not configured");
  }
  if (provider === "MICROSOFT" && !isMicrosoftOAuthConfigured()) {
    return errorRedirect(request, "/login", "Microsoft sign-in is not configured");
  }

  const url = new URL(request.url);
  const mode = (url.searchParams.get("mode") || "login") as IdentityOAuthMode;
  const companyName = url.searchParams.get("companyName")?.trim() || undefined;
  const inviteToken = url.searchParams.get("inviteToken")?.trim() || undefined;
  const returnTo = url.searchParams.get("returnTo")?.trim() || undefined;
  const acceptedLegal = url.searchParams.get("acceptedLegal") === "1";

  if (mode === "register" && !companyName) {
    return errorRedirect(request, "/register", "Company name is required");
  }
  if (mode === "register" && !acceptedLegal) {
    return errorRedirect(request, "/register", "You must agree to the Terms of Service and Privacy Policy");
  }
  if (mode === "accept-invite" && !inviteToken) {
    return errorRedirect(request, "/login", "Invalid invite link");
  }
  if (mode === "accept-invite" && !acceptedLegal) {
    const path = inviteToken
      ? `/accept-invite?token=${encodeURIComponent(inviteToken)}`
      : "/login";
    return errorRedirect(request, path, "You must agree to the Terms of Service and Privacy Policy");
  }

  const state = encodeOAuthState({
    mode,
    provider,
    nonce: randomBytes(16).toString("hex"),
    companyName,
    inviteToken,
    returnTo,
    acceptedLegal: mode === "register" || mode === "accept-invite" ? acceptedLegal : undefined
  });

  const cookieStore = await cookies();
  cookieStore.set(IDENTITY_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge: 60 * 15
  });

  const requestOrigin = requestPublicOrigin(request);
  const authorizeUrl =
    provider === "GOOGLE"
      ? getGoogleIdentityAuthorizeUrl(state, requestOrigin)
      : getMicrosoftIdentityAuthorizeUrl(state, requestOrigin);

  return NextResponse.redirect(authorizeUrl);
}
