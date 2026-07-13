import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { exchangeAuthorizationCode } from "@/lib/quickbooks/online";
import { OAUTH_STATE_COOKIE } from "@/lib/quickbooks/types";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/accounting?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  const cookieStore = await cookies();
  const stored = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!code || !realmId || !state || !stored || state !== stored) {
    return NextResponse.redirect(
      new URL("/admin/accounting?error=Invalid%20OAuth%20callback", request.url)
    );
  }

  const companyIdFromState = state.split(":")[0];
  if (companyIdFromState !== admin.companyId) {
    return NextResponse.redirect(
      new URL("/admin/accounting?error=OAuth%20company%20mismatch", request.url)
    );
  }

  try {
    await exchangeAuthorizationCode({
      companyId: admin.companyId,
      code,
      realmId
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token exchange failed";
    return NextResponse.redirect(
      new URL(`/admin/accounting?error=${encodeURIComponent(message)}`, request.url)
    );
  }

  return NextResponse.redirect(new URL("/admin/accounting?connected=1", request.url));
}
