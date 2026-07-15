import { NextResponse, type NextRequest } from "next/server";

const sessionCookieName = "tms_session";
const publicPaths = [
  "/",
  "/login",
  "/register",
  "/change-password",
  "/accept-invite",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
  "/hooks",
  "/portal",
  "/api/auth/oauth",
  "/api/stripe/webhook",
  "/api/portal"
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = publicPaths.some((path) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`)
  );
  const hasSession = Boolean(request.cookies.get(sessionCookieName)?.value);

  if (!hasSession && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Pass pathname into RSC layouts via request headers (response headers are not readable there).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
