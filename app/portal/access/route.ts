import { NextRequest, NextResponse } from "next/server";
import {
  createPortalLinkSessionToken,
  portalSessionCookieName,
  portalSessionCookieOptions,
  resolvePortalAccessLink
} from "@/lib/portal-auth";

function loginRedirect(request: NextRequest, error: string) {
  const url = new URL("/portal/login", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

async function redeemAndRedirect(request: NextRequest, rawToken: string | null) {
  const resolved = await resolvePortalAccessLink(rawToken ?? "");
  if (!resolved.ok) {
    return loginRedirect(request, resolved.error);
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

/** Query-param magic links: /portal/access?token=… */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  return redeemAndRedirect(request, token);
}
