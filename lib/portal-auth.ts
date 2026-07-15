import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";

export const portalSessionCookieName = "tms_portal_session";
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

async function setPortalSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(portalSessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    expires: expiresAt
  });
}

export async function createPortalUserSession(portalUserId: string, customerId: string) {
  const token = createPortalRawToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + portalSessionDays);

  await prisma.customerPortalSession.deleteMany({ where: { portalUserId } });
  await prisma.customerPortalSession.create({
    data: {
      tokenHash: hashToken(token),
      customerId,
      portalUserId,
      expiresAt
    }
  });

  await setPortalSessionCookie(token, expiresAt);
}

export async function createPortalLinkSession(
  portalLinkId: string,
  customerId: string,
  linkExpiresAt: Date | null
) {
  const created = await createPortalLinkSessionToken(portalLinkId, customerId, linkExpiresAt);
  await setPortalSessionCookie(created.token, created.expiresAt);
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

  await prisma.customerPortalSession.create({
    data: {
      tokenHash: hashToken(token),
      customerId,
      portalLinkId,
      expiresAt
    }
  });

  return { token, expiresAt };
}

export function portalSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookies(),
    path: "/",
    expires: expiresAt
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
  if (!token) {
    return null;
  }

  const session = await prisma.customerPortalSession.findUnique({
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

  if (!session || session.expiresAt < new Date()) {
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
