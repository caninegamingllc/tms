import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";

export const portalSessionCookieName = "tms_portal_session";
/** Server-side max lifetime for cleanup if the browser stays open. Cookie itself is session-only. */
const portalSessionDays = 7;
const portalLinkSessionHours = 24;
const lastSeenThrottleMs = 5 * 60 * 1000;

export type PortalViewer = {
  customerId: string;
  companyId: string;
  companyName: string;
  customerName: string;
  accessMode: "user" | "link";
  portalUserId: string | null;
  portalUserName: string | null;
  portalUserEmail: string | null;
  companyLogoPath: string | null;
};

function shouldUseSecureCookies() {
  if (process.env.COOKIE_SECURE === "true") {
    return true;
  }
  if (process.env.COOKIE_SECURE === "false") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createPortalRawToken() {
  return randomBytes(32).toString("base64url");
}

export function hashPortalToken(token: string) {
  return hashToken(token);
}

/** Browser session cookie: cleared when the browser/tab session ends (no Max-Age/Expires). */
async function setPortalSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(portalSessionCookieName, token, portalSessionCookieOptions());
}

export async function createPortalUserSession(portalUserId: string, customerId: string) {
  const token = createPortalRawToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + portalSessionDays);

  await prisma.$transaction([
    prisma.customerPortalSession.deleteMany({ where: { portalUserId } }),
    prisma.customerPortalSession.create({
      data: {
        tokenHash: hashToken(token),
        customerId,
        portalUserId,
        expiresAt
      }
    })
  ]);

  await setPortalSessionCookie(token);
}

export async function createPortalLinkSession(
  portalLinkId: string,
  customerId: string,
  linkExpiresAt: Date | null
) {
  const created = await createPortalLinkSessionToken(portalLinkId, customerId, linkExpiresAt);
  await setPortalSessionCookie(created.token);
  return created;
}

/** Creates the DB session and returns the raw cookie token (for Route Handlers). */
export async function createPortalLinkSessionToken(
  portalLinkId: string,
  customerId: string,
  linkExpiresAt: Date | null
) {
  const token = createPortalRawToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + portalLinkSessionHours);
  if (linkExpiresAt && linkExpiresAt < expiresAt) {
    expiresAt.setTime(linkExpiresAt.getTime());
  }

  // One active magic-link session per link (new redeem invalidates prior browsers).
  await prisma.$transaction([
    prisma.customerPortalSession.deleteMany({ where: { portalLinkId } }),
    prisma.customerPortalSession.create({
      data: {
        tokenHash: hashToken(token),
        customerId,
        portalLinkId,
        expiresAt
      }
    })
  ]);

  return { token, expiresAt };
}

/** Session cookie options — omit expires/maxAge so closing the browser logs the portal user out. */
export function portalSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookies(),
    path: "/"
  };
}

export async function resolvePortalAccessLink(rawToken: string) {
  const token = rawToken.trim();
  if (!token) {
    return { ok: false as const, error: "This access link is missing." };
  }

  const link = await prisma.customerPortalLink.findFirst({
    where: {
      tokenHash: hashToken(token),
      revokedAt: null,
      company: { status: "ACTIVE" }
    }
  });

  if (!link) {
    return { ok: false as const, error: "This access link is invalid." };
  }
  if (link.expiresAt && link.expiresAt < new Date()) {
    return { ok: false as const, error: "This access link has expired." };
  }

  return { ok: true as const, link };
}

export async function redeemPortalAccessToken(rawToken: string) {
  const resolved = await resolvePortalAccessLink(rawToken);
  if (!resolved.ok) {
    redirect(`/portal/login?error=${encodeURIComponent(resolved.error)}`);
  }

  await createPortalLinkSession(resolved.link.id, resolved.link.customerId, resolved.link.expiresAt);
  redirect("/portal");
}

export const getPortalViewer = cache(async (): Promise<PortalViewer | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(portalSessionCookieName)?.value;
  // #region agent log
  fetch("http://127.0.0.1:7764/ingest/14c39c80-17b4-4dcd-8347-dae6ec7f550a", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9554aa" },
    body: JSON.stringify({
      sessionId: "9554aa",
      runId: "pre-fix",
      hypothesisId: "A",
      location: "lib/portal-auth.ts:getPortalViewer",
      message: "portal session cookie check",
      data: { hasToken: Boolean(token) },
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion
  if (!token) {
    return null;
  }

  let session;
  try {
    session = await prisma.customerPortalSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        customer: {
          include: {
            company: {
              select: { id: true, name: true, status: true, logoFilePath: true }
            }
          }
        },
        portalUser: true,
        portalLink: true
      }
    });
  } catch (error) {
    // #region agent log
    fetch("http://127.0.0.1:7764/ingest/14c39c80-17b4-4dcd-8347-dae6ec7f550a", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9554aa" },
      body: JSON.stringify({
        sessionId: "9554aa",
        runId: "pre-fix",
        hypothesisId: "A",
        location: "lib/portal-auth.ts:sessionLookup",
        message: "portal session Prisma lookup failed",
        data: {
          errorName: error instanceof Error ? error.name : "unknown",
          errorMessage: error instanceof Error ? error.message : String(error)
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
    throw error;
  }

  if (!session || session.expiresAt < new Date()) {
    // #region agent log
    fetch("http://127.0.0.1:7764/ingest/14c39c80-17b4-4dcd-8347-dae6ec7f550a", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9554aa" },
      body: JSON.stringify({
        sessionId: "9554aa",
        runId: "pre-fix",
        hypothesisId: "A",
        location: "lib/portal-auth.ts:sessionInvalid",
        message: "portal session missing or expired",
        data: { found: Boolean(session), expired: Boolean(session && session.expiresAt < new Date()) },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
    if (session) {
      await prisma.customerPortalSession.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    return null;
  }

  if (session.customer.company.status !== "ACTIVE") {
    return null;
  }

  if (session.portalUserId && session.portalUser) {
    if (session.portalUser.status !== "ACTIVE" || session.portalUser.disabledAt) {
      return null;
    }
  }

  if (session.portalLinkId && session.portalLink) {
    if (session.portalLink.revokedAt) {
      return null;
    }
    if (session.portalLink.expiresAt && session.portalLink.expiresAt < new Date()) {
      return null;
    }
  }

  if (Date.now() - session.lastSeenAt.getTime() > lastSeenThrottleMs) {
    await prisma.customerPortalSession
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() }
      })
      .catch(() => undefined);
  }

  return {
    customerId: session.customerId,
    companyId: session.customer.companyId,
    companyName: session.customer.company.name,
    customerName: session.customer.name,
    accessMode: session.portalUserId ? "user" : "link",
    portalUserId: session.portalUserId,
    portalUserName: session.portalUser?.name ?? null,
    portalUserEmail: session.portalUser?.email ?? null,
    companyLogoPath: session.customer.company.logoFilePath
  };
});

export async function requirePortalViewer(): Promise<PortalViewer> {
  const viewer = await getPortalViewer();
  if (!viewer) {
    redirect("/portal/login");
  }
  return viewer;
}

export async function destroyPortalSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(portalSessionCookieName)?.value;
  if (token) {
    await prisma.customerPortalSession.deleteMany({
      where: { tokenHash: hashToken(token) }
    });
  }
  cookieStore.delete(portalSessionCookieName);
}
