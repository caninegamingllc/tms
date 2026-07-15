import { NextRequest, NextResponse } from "next/server";
import {
  createPortalLinkSessionToken,
  portalSessionCookieName,
  portalSessionCookieOptions,
  resolvePortalAccessLink
} from "@/lib/portal-auth";

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
    const url = new URL("/portal/login", request.url);
    url.searchParams.set("error", resolved.error);
    return NextResponse.redirect(url);
  }

  const session = await createPortalLinkSessionToken(
    resolved.link.id,
    resolved.link.customerId,
    resolved.link.expiresAt
  );

  const response = NextResponse.redirect(new URL("/portal", request.url));
  response.cookies.set(
    portalSessionCookieName,
    session.token,
    portalSessionCookieOptions(session.expiresAt)
  );
  return response;
}
