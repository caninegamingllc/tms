import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { appBaseUrl } from "@/lib/app-url";
import { isSmtpConfigured, sendPasswordResetEmail } from "@/lib/mail";

export const sessionCookieName = "tms_session";
const sessionDays = 7;
const passwordKeyLength = 64;
const passwordResetHours = 1;

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
  ["QUICKBOOKS", "QuickBooks Online", "Future invoice and bill sync."],
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

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + sessionDays);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
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

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { company: true } } }
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  if (
    session.user.status !== "ACTIVE" ||
    session.user.company.status !== "ACTIVE" ||
    session.user.lockedAt ||
    session.user.disabledAt
  ) {
    await prisma.session.deleteMany({ where: { userId: session.userId } });
    return null;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() }
  });

  return {
    id: session.user.id,
    companyId: session.user.companyId,
    companyName: session.user.company.name,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    status: session.user.status,
    mustChangePassword: session.user.mustChangePassword,
    branchId: session.user.branchId
  };
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  return user;
}

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

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash);

  if (!user || !valid) {
    redirect("/login?error=Invalid%20email%20or%20password");
  }

  if (user.status !== "ACTIVE" || user.lockedAt || user.disabledAt) {
    redirect("/login?error=This%20account%20is%20locked%20or%20disabled");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });
  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      action: "LOGIN",
      entityType: "User",
      entityId: user.id,
      details: "User signed in."
    }
  });
  await createSession(user.id);

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

  if (!token) {
    redirect("/login?error=Invalid%20invite%20link");
  }

  if (password.length < 8 || password !== confirmPassword) {
    redirect(`/accept-invite?token=${encodeURIComponent(token)}&error=Password%20must%20match%20and%20be%20at%20least%208%20characters`);
  }

  const user = await prisma.user.findUnique({
    where: { inviteTokenHash: hashToken(token) },
    include: { company: true }
  });

  if (!user || user.status !== "INVITED" || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
    redirect("/login?error=This%20invite%20link%20is%20invalid%20or%20expired");
  }

  if (user.company.status !== "ACTIVE") {
    redirect("/login?error=This%20organization%20is%20not%20active");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      status: "ACTIVE",
      mustChangePassword: false,
      inviteTokenHash: null,
      inviteExpiresAt: null,
      lastLoginAt: new Date()
    }
  });

  await prisma.auditLog.create({
    data: {
      companyId: user.companyId,
      actorUserId: user.id,
      targetUserId: user.id,
      action: "ACCEPT_INVITE",
      entityType: "User",
      entityId: user.id,
      details: `${user.email} accepted their invite.`
    }
  });

  await createSession(user.id);
  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  let devResetUrl: string | undefined;

  if (
    user &&
    user.status === "ACTIVE" &&
    !user.lockedAt &&
    !user.disabledAt &&
    user.passwordHash
  ) {
    const token = randomBytes(32).toString("base64url");
    const passwordResetExpiresAt = new Date();
    passwordResetExpiresAt.setHours(passwordResetExpiresAt.getHours() + passwordResetHours);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: hashToken(token),
        passwordResetExpiresAt
      }
    });

    const resetUrl = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    await sendPasswordResetEmail(user.email, resetUrl);

    if (process.env.NODE_ENV === "development" && !isSmtpConfigured()) {
      devResetUrl = resetUrl;
    }

    await prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        actorUserId: user.id,
        targetUserId: user.id,
        action: "REQUEST_PASSWORD_RESET",
        entityType: "User",
        entityId: user.id,
        details: `Password reset requested for ${user.email}.`
      }
    });
  }

  const params = new URLSearchParams({ sent: "1" });
  if (devResetUrl) {
    params.set("reset", devResetUrl);
  }

  redirect(`/forgot-password?${params.toString()}`);
}

export async function resetPassword(formData: FormData) {
  "use server";

  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    redirect("/login?error=Invalid%20password%20reset%20link");
  }

  if (password.length < 8 || password !== confirmPassword) {
    redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=Password%20must%20match%20and%20be%20at%20least%208%20characters`
    );
  }

  const user = await prisma.user.findUnique({
    where: { passwordResetTokenHash: hashToken(token) }
  });

  if (
    !user ||
    user.status !== "ACTIVE" ||
    user.lockedAt ||
    user.disabledAt ||
    !user.passwordResetExpiresAt ||
    user.passwordResetExpiresAt < new Date()
  ) {
    redirect("/login?error=This%20password%20reset%20link%20is%20invalid%20or%20expired");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
      passwordResetAt: new Date(),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null
    }
  });

  await prisma.session.deleteMany({ where: { userId: user.id } });

  await prisma.auditLog.create({
    data: {
      companyId: user.companyId,
      actorUserId: user.id,
      targetUserId: user.id,
      action: "RESET_PASSWORD",
      entityType: "User",
      entityId: user.id,
      details: `${user.email} reset their password.`
    }
  });

  redirect("/login?message=Password%20updated.%20Sign%20in%20with%20your%20new%20password.");
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

export async function registerCompany(formData: FormData) {
  "use server";

  const companyName = String(formData.get("companyName") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

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

  const slug = await uniqueCompanySlug(companyName);
  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: companyName,
        slug,
        status: "ACTIVE"
      }
    });

    const branch = await tx.branch.create({
      data: {
        companyId: company.id,
        name: `${companyName} HQ`
      }
    });

    const owner = await tx.user.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        name,
        email,
        role: "OWNER",
        status: "ACTIVE",
        passwordHash,
        mustChangePassword: false
      }
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

    return owner;
  });

  await createSession(user.id);
  redirect("/");
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
