import { NextRequest, NextResponse } from "next/server";
import { requestPublicOrigin, resolvePublicAppUrl } from "@/lib/app-url";
import {
  createPortalLinkSessionToken,
  portalSessionCookieName,
  portalSessionCookieOptions,
  resolvePortalAccessLink
} from "@/lib/portal-auth";

function portalRedirect(request: NextRequest, pathWithQuery: string) {
  const path = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  const base = resolvePublicAppUrl(requestPublicOrigin(request));
  return NextResponse.redirect(new URL(path, `${base}/`));
}

/**
 * Path-param magic links (legacy + current broker copies):
 * /portal/access/:token
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw ?? "").trim();
  const resolved = await resolvePortalAccessLink(token);

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
  response.cookies.set(
    portalSessionCookieName,
    session.token,
    portalSessionCookieOptions(session.expiresAt)
  );
  return response;
}
