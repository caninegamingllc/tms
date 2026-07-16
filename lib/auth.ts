import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  assertInviteAcceptNotRateLimited,
  assertLoginNotRateLimited,
  assertRegisterNotRateLimited
} from "@/lib/auth-rate-limit";
import { prisma } from "@/lib/db";
import { seedCompanyCatalogs } from "@/lib/catalogs";
import { didAcceptLegal, legalAcceptanceData } from "@/lib/legal";
import { normalizePlanId } from "@/lib/plans";
import { tryAutoAssignSeat } from "@/lib/seats";
import { ensureMembershipBranchesSynced } from "@/lib/membership-branches";
import type { OrganizationSummary, SessionUser } from "@/lib/types";

export const sessionCookieName = "tms_session";
const sessionDays = 7;
const passwordKeyLength = 64;
/** Avoid a SQLite write on every layout/page/heartbeat when lastSeen is fresh. */
const lastSeenThrottleMs = 5 * 60 * 1000;

function shouldUseSecureCookies() {
  if (process.env.COOKIE_SECURE === "true") {
    return true;
  }
  if (process.env.COOKIE_SECURE === "false") {
    return false;
  }

  return process.env.NODE_ENV === "production";
}

export type CurrentUser = SessionUser;

const starterIntegrations = [
  ["DAT", "DAT Load Board", "Future posting and truck search integration."],
  ["TRUCKSTOP", "Truckstop", "Future rate and posting integration."],
  ["QUICKBOOKS", "QuickBooks Online", "Sync invoices and carrier bills via QuickBooks Online API."],
  ["TRUCKER_TOOLS", "Tracking and Document Capture", "Future driver tracking and POD capture."]
] as const;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, passwordKeyLength).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export async function verifyPassword(password: string, storedHash?: string | null) {
  if (!storedHash) {
    return false;
  }

  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
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
    include: { company: { include: { seatSubscription: true } } },
    orderBy: { company: { name: "asc" } }
  });
}

function membershipPlan(
  membership: Awaited<ReturnType<typeof getActiveMemberships>>[number]
) {
  return normalizePlanId(membership.company.seatSubscription?.plan);
}

function toOrganizationSummary(
  membership: Awaited<ReturnType<typeof getActiveMemberships>>[number]
): OrganizationSummary {
  return {
    membershipId: membership.id,
    companyId: membership.companyId,
    companyName: membership.company.name,
    role: membership.role,
    hasSeat: membership.seatAssignedAt != null,
    plan: membershipPlan(membership)
  };
}

function buildSessionUser(
  user: { id: string; name: string; email: string; mustChangePassword: boolean },
  membership: Awaited<ReturnType<typeof getActiveMemberships>>[number],
  organizations: OrganizationSummary[],
  branchIds: string[]
): SessionUser {
  return {
    id: user.id,
    membershipId: membership.id,
    companyId: membership.companyId,
    companyName: membership.company.name,
    name: user.name,
    email: user.email,
    role: membership.role,
    status: membership.status,
    mustChangePassword: user.mustChangePassword,
    branchId: membership.branchId,
    branchIds,
    hasSeat: membership.seatAssignedAt != null,
    plan: membershipPlan(membership),
    organizations
  };
}

/** Invalidate every TMS session for this user (other browsers / devices). */
export async function revokeAllUserSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

async function setStaffSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    expires: expiresAt
  });
}

/**
 * Create the sole active session for a user.
 * Any prior sessions (other browsers) are revoked so only this login remains valid.
 */
export async function createSession(userId: string, membershipId: string) {
  const membership = await prisma.companyMembership.findFirst({
    where: {
      id: membershipId,
      userId,
      status: "ACTIVE",
      lockedAt: null,
      disabledAt: null
    }
  });

  if (!membership) {
    throw new Error("Invalid membership for session.");
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + sessionDays);

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId } }),
    prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        membershipId,
        expiresAt
      }
    })
  ]);

  await setStaffSessionCookie(token, expiresAt);
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) }
    });
  }

  cookieStore.delete(sessionCookieName);
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: true,
      membership: { include: { company: { include: { seatSubscription: true } } } }
    }
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  const membership = session.membership;

  if (
    membership.status !== "ACTIVE" ||
    membership.company.status !== "ACTIVE" ||
    membership.lockedAt ||
    membership.disabledAt
  ) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  const now = Date.now();
  const lastSeenAt = session.lastSeenAt?.getTime() ?? 0;
  if (now - lastSeenAt >= lastSeenThrottleMs) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(now) }
    });
  }

  const activeMemberships = await getActiveMemberships(session.userId);
  const organizations = activeMemberships.map(toOrganizationSummary);
  const branchIds = await ensureMembershipBranchesSynced(membership.id, membership.branchId);

  return buildSessionUser(session.user, membership, organizations, branchIds);
});

export const requireUser = cache(async () => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.mustChangePassword) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true }
    });
    // OAuth-only users never need a forced password change.
    if (dbUser?.passwordHash) {
      redirect("/change-password");
    }
  }

  return user;
});

export async function requireAdmin() {
  const user = await requireUser();

  if (!["OWNER", "ADMIN"].includes(user.role)) {
    redirect("/");
  }

  return user;
}

export async function login(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  await assertLoginNotRateLimited(email);

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash);

  if (!user || !valid) {
    redirect("/login?error=Invalid%20email%20or%20password");
  }

  const memberships = await getActiveMemberships(user.id);

  if (memberships.length === 0) {
    redirect("/login?error=No%20active%20organization%20memberships%20found");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  if (memberships.length > 1) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Single-session: wipe other browsers before the org-picker interim session.
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { userId: user.id } }),
      prisma.session.create({
        data: {
          tokenHash: hashToken(token),
          userId: user.id,
          membershipId: memberships[0].id,
          expiresAt
        }
      })
    ]);

    await setStaffSessionCookie(token, expiresAt);

    if (user.mustChangePassword) {
      redirect("/change-password");
    }

    redirect("/select-organization");
  }

  await prisma.auditLog.create({
    data: {
      companyId: memberships[0].companyId,
      actorUserId: user.id,
      action: "LOGIN",
      entityType: "User",
      entityId: user.id,
      details: "User signed in."
    }
  });

  await createSession(user.id, memberships[0].id);

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  redirect("/");
}

export async function acceptInvite(formData: FormData) {
  "use server";

  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  await assertInviteAcceptNotRateLimited(token);

  if (!token) {
    redirect("/login?error=Invalid%20invite%20link");
  }

  if (!didAcceptLegal(formData)) {
    redirect(
      `/accept-invite?token=${encodeURIComponent(token)}&error=${encodeURIComponent(
        "You must agree to the Terms of Service and Privacy Policy"
      )}`
    );
  }

  const membership = await prisma.companyMembership.findUnique({
    where: { inviteTokenHash: hashToken(token) },
    include: { user: true, company: true }
  });

  if (
    !membership ||
    membership.status !== "INVITED" ||
    !membership.inviteExpiresAt ||
    membership.inviteExpiresAt < new Date()
  ) {
    redirect("/login?error=This%20invite%20link%20is%20invalid%20or%20expired");
  }

  if (membership.company.status !== "ACTIVE") {
    redirect("/login?error=This%20organization%20is%20not%20active");
  }

  const user = membership.user;
  const isNewUser = !user.passwordHash;
  const acceptance = legalAcceptanceData();

  if (isNewUser) {
    if (password.length < 8 || password !== confirmPassword) {
      redirect(
        `/accept-invite?token=${encodeURIComponent(token)}&error=Password%20must%20match%20and%20be%20at%20least%208%20characters`
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        mustChangePassword: false,
        lastLoginAt: new Date(),
        ...acceptance
      }
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), ...acceptance }
    });
  }

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
      actorUserId: user.id,
      targetUserId: user.id,
      action: "ACCEPT_INVITE",
      entityType: "CompanyMembership",
      entityId: membership.id,
      details: `${user.email} accepted their invite to ${membership.company.name}.`
    }
  });

  const activeMemberships = await getActiveMemberships(user.id);

  if (activeMemberships.length > 1) {
    await createSession(user.id, membership.id);
    redirect("/select-organization");
  }

  await createSession(user.id, membership.id);
  redirect("/");
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "company"
  );
}

async function uniqueCompanySlug(companyName: string) {
  const base = slugify(companyName);
  let slug = base;
  let suffix = 2;

  while (await prisma.company.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

export async function createCompanyWorkspace(input: {
  companyName: string;
  name: string;
  email: string;
  passwordHash?: string | null;
  legalAcceptedAt?: Date | null;
  legalDocumentVersion?: string | null;
}) {
  const slug = await uniqueCompanySlug(input.companyName);
  const acceptance =
    input.legalAcceptedAt && input.legalDocumentVersion
      ? {
          legalAcceptedAt: input.legalAcceptedAt,
          legalDocumentVersion: input.legalDocumentVersion
        }
      : legalAcceptanceData();

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: input.companyName,
        slug,
        status: "ACTIVE"
      }
    });

    const branch = await tx.branch.create({
      data: {
        companyId: company.id,
        name: `${input.companyName} HQ`
      }
    });

    const owner = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash ?? null,
        mustChangePassword: false,
        ...acceptance
      }
    });

    const membership = await tx.companyMembership.create({
      data: {
        userId: owner.id,
        companyId: company.id,
        branchId: branch.id,
        role: "OWNER",
        status: "ACTIVE"
      }
    });

    await tx.membershipBranch.create({
      data: { membershipId: membership.id, branchId: branch.id }
    });

    await tx.seatSubscription.create({
      data: {
        companyId: company.id,
        plan: "FREE",
        status: "ACTIVE",
        seatQuantity: 1
      }
    });

    await tx.companyMembership.update({
      where: { id: membership.id },
      data: { seatAssignedAt: new Date() }
    });

    await tx.integrationAccount.createMany({
      data: starterIntegrations.map(([provider, displayName, notes]) => ({
        companyId: company.id,
        provider,
        displayName,
        status: "Not Connected",
        notes
      }))
    });

    await tx.commissionProfile.create({
      data: {
        companyId: company.id,
        name: "Standard 60/40",
        isDefault: true,
        rule: {
          create: {
            branchSharePercent: 60,
            companySharePercent: 40,
            companyMinimumExpensePercent: 10
          }
        }
      }
    });

    await seedCompanyCatalogs(company.id, tx);

    await tx.auditLog.create({
      data: {
        companyId: company.id,
        actorUserId: owner.id,
        targetUserId: owner.id,
        action: "REGISTER_COMPANY",
        entityType: "Company",
        entityId: company.id,
        details: `${owner.email} registered ${company.name}.`
      }
    });

    return { owner, membership, company };
  });
}

export async function registerCompany(formData: FormData) {
  "use server";

  await assertRegisterNotRateLimited();

  const companyName = String(formData.get("companyName") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!didAcceptLegal(formData)) {
    redirect("/register?error=You%20must%20agree%20to%20the%20Terms%20of%20Service%20and%20Privacy%20Policy");
  }

  if (!companyName || !name || !email) {
    redirect("/register?error=Company%2C%20name%2C%20and%20email%20are%20required");
  }

  if (password.length < 8 || password !== confirmPassword) {
    redirect("/register?error=Password%20must%20match%20and%20be%20at%20least%208%20characters");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    redirect("/register?error=An%20account%20already%20exists%20for%20that%20email");
  }

  const result = await createCompanyWorkspace({
    companyName,
    name,
    email,
    passwordHash: await hashPassword(password),
    ...legalAcceptanceData()
  });

  await createSession(result.owner.id, result.membership.id);
  redirect("/?welcome=1");
}

export async function changeOwnPassword(formData: FormData) {
  "use server";

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8 || newPassword !== confirmPassword) {
    redirect("/change-password?error=Password%20must%20match%20and%20be%20at%20least%208%20characters");
  }

  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const valid = await verifyPassword(currentPassword, dbUser.passwordHash);

  if (!valid) {
    redirect("/change-password?error=Current%20password%20is%20incorrect");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      passwordResetAt: new Date()
    }
  });
  await prisma.auditLog.create({
    data: {
      companyId: user.companyId,
      actorUserId: user.id,
      targetUserId: user.id,
      action: "CHANGE_OWN_PASSWORD",
      entityType: "User",
      entityId: user.id,
      details: "User changed their password."
    }
  });

  redirect("/");
}

export async function getInviteByToken(token: string) {
  const membership = await prisma.companyMembership.findUnique({
    where: { inviteTokenHash: hashToken(token) },
    include: { user: true, company: true }
  });

  if (
    !membership ||
    membership.status !== "INVITED" ||
    !membership.inviteExpiresAt ||
    membership.inviteExpiresAt < new Date()
  ) {
    return null;
  }

  return membership;
}
