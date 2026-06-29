import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const sessionCookieName = "tms_session";
const sessionDays = 7;
const passwordKeyLength = 64;

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  mustChangePassword: boolean;
  branchId: string | null;
};

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
    secure: process.env.NODE_ENV === "production",
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
    include: { user: true }
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  if (session.user.status !== "ACTIVE" || session.user.lockedAt || session.user.disabledAt) {
    await prisma.session.deleteMany({ where: { userId: session.userId } });
    return null;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() }
  });

  return {
    id: session.user.id,
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
