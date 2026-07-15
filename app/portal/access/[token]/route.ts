import { NextResponse } from "next/server";
import {
  createPortalLinkSessionToken,
  portalSessionCookieName,
  portalSessionCookieOptions,
  resolvePortalAccessLink
} from "@/lib/portal-auth";

/** Relative Location so nginx-proxied localhost request URLs do not leak to clients. */
function portalRedirect(pathWithQuery: string) {
  const path = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  return new NextResponse(null, {
    status: 307,
    headers: { Location: path }
  });
}

/**
 * Path-param magic links (legacy + current broker copies):
 * /portal/access/:token
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw ?? "").trim();
  const resolved = await resolvePortalAccessLink(token);

  if (!resolved.ok) {
    return portalRedirect(`/portal/login?error=${encodeURIComponent(resolved.error)}`);
  }

  const session = await createPortalLinkSessionToken(
    resolved.link.id,
    resolved.link.customerId,
    resolved.link.expiresAt
  );

  const response = portalRedirect("/portal");
  response.cookies.set(
    portalSessionCookieName,
    session.token,
    portalSessionCookieOptions(session.expiresAt)
  );
  return response;
}
