import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getQuickbooksAuthorizeUrl, isQuickbooksOnlineConfigured } from "@/lib/quickbooks/online";
import { OAUTH_STATE_COOKIE } from "@/lib/quickbooks/types";

export async function GET(request: Request) {
  await requireAdmin();

  if (!isQuickbooksOnlineConfigured()) {
    return NextResponse.redirect(
      new URL("/admin/accounting?error=QuickBooks%20Online%20is%20not%20configured", request.url)
    );
  }

  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const stored = cookieStore.get(OAUTH_STATE_COOKIE)?.value;

  if (!state || !stored || state !== stored) {
    return NextResponse.redirect(
      new URL("/admin/accounting?error=Invalid%20OAuth%20state", request.url)
    );
  }

  const authorizeUrl = getQuickbooksAuthorizeUrl(state);
  return NextResponse.redirect(authorizeUrl);
}
