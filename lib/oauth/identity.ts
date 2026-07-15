import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  createCompanyWorkspace,
  createSession,
  getInviteByToken,
  sessionCookieName
} from "@/lib/auth";
import { legalAcceptanceData } from "@/lib/legal";
import { tryAutoAssignSeat } from "@/lib/seats";
import type { OAuthProfile } from "@/lib/oauth/google";
import {
  IDENTITY_OAUTH_STATE_COOKIE,
  shouldUseSecureCookies,
  type IdentityOAuthState,
  type OAuthProvider
} from "@/lib/oauth/types";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getActiveMemberships(userId: string) {
  return prisma.companyMembership.findMany({
    where: {
      userId,
      status: "ACTIVE",
      lockedAt: null,
      disabledAt: null,
      company: { status: "ACTIVE" }
    },
    include: { company: true },
    orderBy: { company: { name: "asc" } }
  });
}

async function linkOAuthAccount(userId: string, profile: OAuthProfile) {
  const existingByProvider = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId
      }
    }
  });

  if (existingByProvider && existingByProvider.userId !== userId) {
    throw new Error("This Google/Microsoft account is already linked to another user.");
  }

  await prisma.oAuthAccount.upsert({
    where: {
      userId_provider: {
        userId,
        provider: profile.provider
      }
    },
    create: {
      userId,
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      email: profile.email
    },
    update: {
      providerAccountId: profile.providerAccountId,
      email: profile.email
    }
  });
}

async function finishLoginSession(userId: string, preferredMembershipId?: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date(), mustChangePassword: false }
  });

  const memberships = await getActiveMemberships(userId);
  if (memberships.length === 0) {
    return { redirectTo: "/login?error=No%20active%20organization%20memberships%20found" };
  }

  const preferred =
    (preferredMembershipId
      ? memberships.find((membership) => membership.id === preferredMembershipId)
      : null) ?? memberships[0];

  if (memberships.length > 1 && !preferredMembershipId) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await prisma.session.deleteMany({ where: { userId } });
    await prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        membershipId: preferred.id,
        expiresAt
      }
    });

    const cookieStore = await cookies();
    cookieStore.set(sessionCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookies(),
      path: "/",
      expires: expiresAt
    });

    return { redirectTo: "/select-organization" };
  }

  await prisma.auditLog.create({
    data: {
      companyId: preferred.companyId,
      actorUserId: userId,
      action: "LOGIN",
      entityType: "User",
      entityId: userId,
      details: "User signed in with OAuth."
    }
  });

  await createSession(userId, preferred.id);
  return { redirectTo: "/" };
}

async function resolveUserForLogin(profile: OAuthProfile) {
  const byProvider = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId
      }
    },
    include: { user: true }
  });

  if (byProvider) {
    return byProvider.user;
  }

  const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (byEmail) {
    await linkOAuthAccount(byEmail.id, profile);
    return byEmail;
  }

  return null;
}

async function handleLogin(profile: OAuthProfile) {
  const user = await resolveUserForLogin(profile);
  if (!user) {
    return {
      redirectTo:
        "/login?error=No%20account%20found%20for%20that%20email.%20Register%20a%20company%20or%20accept%20an%20invite%20first."
    };
  }

  return finishLoginSession(user.id);
}

async function handleRegister(
  profile: OAuthProfile,
  companyName?: string,
  acceptedLegal?: boolean
) {
  if (!acceptedLegal) {
    return {
      redirectTo:
        "/register?error=You%20must%20agree%20to%20the%20Terms%20of%20Service%20and%20Privacy%20Policy"
    };
  }

  if (!companyName?.trim()) {
    return { redirectTo: "/register?error=Company%20name%20is%20required" };
  }

  const existingByProvider = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId
      }
    }
  });
  if (existingByProvider) {
    return finishLoginSession(existingByProvider.userId);
  }

  const existingUser = await prisma.user.findUnique({ where: { email: profile.email } });
  if (existingUser) {
    return {
      redirectTo:
        "/register?error=An%20account%20already%20exists%20for%20that%20email.%20Sign%20in%20instead."
    };
  }

  const result = await createCompanyWorkspace({
    companyName: companyName.trim(),
    name: profile.name,
    email: profile.email,
    passwordHash: null,
    ...legalAcceptanceData()
  });

  await linkOAuthAccount(result.owner.id, profile);
  await createSession(result.owner.id, result.membership.id);
  return { redirectTo: "/admin/billing?welcome=1" };
}

async function handleAcceptInvite(
  profile: OAuthProfile,
  inviteToken?: string,
  acceptedLegal?: boolean
) {
  if (!inviteToken) {
    return { redirectTo: "/login?error=Invalid%20invite%20link" };
  }

  if (!acceptedLegal) {
    return {
      redirectTo: `/accept-invite?token=${encodeURIComponent(inviteToken)}&error=${encodeURIComponent(
        "You must agree to the Terms of Service and Privacy Policy"
      )}`
    };
  }

  const membership = await getInviteByToken(inviteToken);
  if (!membership) {
    return { redirectTo: "/login?error=This%20invite%20link%20is%20invalid%20or%20expired" };
  }

  if (membership.company.status !== "ACTIVE") {
    return { redirectTo: "/login?error=This%20organization%20is%20not%20active" };
  }

  const invitedEmail = membership.user.email.toLowerCase();
  if (profile.email !== invitedEmail) {
    return {
      redirectTo: `/accept-invite?token=${encodeURIComponent(inviteToken)}&error=${encodeURIComponent(
        `Sign in with ${invitedEmail} to accept this invite.`
      )}`
    };
  }

  const existingLink = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId
      }
    }
  });

  if (existingLink && existingLink.userId !== membership.userId) {
    return {
      redirectTo: `/accept-invite?token=${encodeURIComponent(inviteToken)}&error=${encodeURIComponent(
        "That Google/Microsoft account is linked to a different user."
      )}`
    };
  }

  await prisma.user.update({
    where: { id: membership.userId },
    data: {
      name: membership.user.name || profile.name,
      mustChangePassword: false,
      lastLoginAt: new Date(),
      ...legalAcceptanceData()
    }
  });

  await linkOAuthAccount(membership.userId, profile);

  await prisma.companyMembership.update({
    where: { id: membership.id },
    data: {
      status: "ACTIVE",
      inviteTokenHash: null,
      inviteExpiresAt: null
    }
  });

  await tryAutoAssignSeat(membership.id, membership.companyId);

  await prisma.auditLog.create({
    data: {
      companyId: membership.companyId,
      actorUserId: membership.userId,
      targetUserId: membership.userId,
      action: "ACCEPT_INVITE",
      entityType: "CompanyMembership",
      entityId: membership.id,
      details: `${membership.user.email} accepted their invite via OAuth to ${membership.company.name}.`
    }
  });

  return finishLoginSession(membership.userId, membership.id);
}

async function handleLink(profile: OAuthProfile, returnTo?: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) {
    return { redirectTo: "/login?error=Sign%20in%20before%20linking%20an%20account" };
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) }
  });

  if (!session || session.expiresAt < new Date()) {
    return { redirectTo: "/login?error=Session%20expired" };
  }

  await linkOAuthAccount(session.userId, profile);
  return { redirectTo: returnTo || "/settings/email?linked=1" };
}

export async function completeIdentityOAuth(
  state: IdentityOAuthState,
  profile: OAuthProfile
): Promise<{ redirectTo: string }> {
  switch (state.mode) {
    case "login":
      return handleLogin(profile);
    case "register":
      return handleRegister(profile, state.companyName, state.acceptedLegal);
    case "accept-invite":
      return handleAcceptInvite(profile, state.inviteToken, state.acceptedLegal);
    case "link":
      return handleLink(profile, state.returnTo);
    default:
      return { redirectTo: "/login?error=Invalid%20OAuth%20state" };
  }
}

export function isIdentityOAuthConfigured(provider: OAuthProvider) {
  if (provider === "GOOGLE") {
    return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
  }
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID?.trim() && process.env.MICROSOFT_CLIENT_SECRET?.trim()
  );
}

export { IDENTITY_OAUTH_STATE_COOKIE };
