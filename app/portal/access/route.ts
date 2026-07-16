import { NextRequest, NextResponse } from "next/server";
import { requestPublicOrigin, resolvePublicAppUrl } from "@/lib/app-url";
import {
  createPortalLinkSessionToken,
  portalSessionCookieName,
  portalSessionCookieOptions,
  resolvePortalAccessLink
} from "@/lib/portal-auth";

/**
 * Build a redirect that stays on the public site behind nginx.
 * Route Handlers do not get middleware's localhost→relative Location rewrite,
 * so `new URL(path, request.url)` would send browsers to https://localhost:3001.
 */
function portalRedirect(request: NextRequest, pathWithQuery: string) {
  const path = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  const base = resolvePublicAppUrl(requestPublicOrigin(request));
  return NextResponse.redirect(new URL(path, `${base}/`));
}

async function redeemAndRedirect(request: NextRequest, rawToken: string | null) {
  const resolved = await resolvePortalAccessLink(rawToken ?? "");
  if (!resolved.ok) {
    return portalRedirect(
      request,
      `/portal/login?error=${encodeURIComponent(resolved.error)}`
    );
  }

  const session = await createPortalLinkSessionToken(
    resolved.link.id,
    resolved.link.customerId,
    resolved.link.expiresAt
  );

  const response = portalRedirect(request, "/portal");
  response.cookies.set(portalSessionCookieName, session.token, portalSessionCookieOptions());
  return response;
}

/** Query-param magic links: /portal/access?token=… */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  return redeemAndRedirect(request, token);
}
