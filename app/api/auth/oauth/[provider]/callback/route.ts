import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { appAbsoluteUrl, requestPublicOrigin } from "@/lib/app-url";
import { completeGoogleIdentityOAuth } from "@/lib/oauth/google";
import { completeMicrosoftIdentityOAuth } from "@/lib/oauth/microsoft";
import { completeIdentityOAuth } from "@/lib/oauth/identity";
import {
  IDENTITY_OAUTH_STATE_COOKIE,
  decodeOAuthState,
  parseOAuthProvider,
  type IdentityOAuthState
} from "@/lib/oauth/types";

function errorRedirect(request: Request, path: string, message: string) {
  const url = appAbsoluteUrl(path, request);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

function messageRedirect(request: Request, path: string, message: string) {
  const url = appAbsoluteUrl(path, request);
  url.searchParams.set("message", message);
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

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const adminConsent = url.searchParams.get("admin_consent");

  // Microsoft admin-consent redirects here with admin_consent=True|False (no code/state).
  if (adminConsent !== null) {
    if (adminConsent.toLowerCase() === "true") {
      return messageRedirect(
        request,
        "/login",
        "Microsoft admin consent granted. Users can Sign in with Microsoft now."
      );
    }
    return errorRedirect(
      request,
      "/login",
      "Microsoft admin consent was not granted. An admin must Accept for the organization."
    );
  }

  if (oauthError) {
    return errorRedirect(request, "/login", oauthError);
  }

  if (!code || !stateParam) {
    return errorRedirect(request, "/login", "OAuth callback missing code or state");
  }

  const cookieStore = await cookies();
  const stored = cookieStore.get(IDENTITY_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(IDENTITY_OAUTH_STATE_COOKIE);

  if (!stored || stored !== stateParam) {
    return errorRedirect(request, "/login", "Invalid OAuth state");
  }

  const decoded = decodeOAuthState(stateParam);
  if (!decoded || !("mode" in decoded) || decoded.mode === "mailbox") {
    return errorRedirect(request, "/login", "Invalid OAuth state payload");
  }

  const state = decoded as IdentityOAuthState;
  if (state.provider !== provider) {
    return errorRedirect(request, "/login", "OAuth provider mismatch");
  }

  try {
    const requestOrigin = requestPublicOrigin(request);
    const { profile } =
      provider === "GOOGLE"
        ? await completeGoogleIdentityOAuth(code, requestOrigin)
        : await completeMicrosoftIdentityOAuth(code, requestOrigin);

    const result = await completeIdentityOAuth(state, profile);
    return NextResponse.redirect(appAbsoluteUrl(result.redirectTo, request));
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth sign-in failed";
    const fallback =
      state.mode === "register"
        ? "/register"
        : state.mode === "accept-invite" && state.inviteToken
          ? `/accept-invite?token=${encodeURIComponent(state.inviteToken)}`
          : "/login";
    return errorRedirect(request, fallback, message);
  }
}
