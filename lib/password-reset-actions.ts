"use server";

import { randomBytes, createHash } from "crypto";
import { redirect } from "next/navigation";
import { appBaseUrl } from "@/lib/app-url";
import { hashPassword } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/mail";
import { prisma } from "@/lib/db";

const passwordResetHours = 1;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  let devToken: string | undefined;

  if (
    user &&
    user.passwordHash
  ) {
    const activeMembership = await prisma.companyMembership.findFirst({
      where: {
        userId: user.id,
        status: "ACTIVE",
        lockedAt: null,
        disabledAt: null
      }
    });

    if (!activeMembership) {
      redirect(`/forgot-password?sent=1`);
    }

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
    let delivered = false;

    try {
      const result = await sendPasswordResetEmail(user.email, resetUrl);
      delivered = result.delivered;
    } catch (error) {
      console.error("[password-reset] email delivery failed:", error);
    }

    if (process.env.NODE_ENV === "development" && !delivered) {
      devToken = token;
    }

    await prisma.auditLog.create({
      data: {
        companyId: activeMembership.companyId,
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
  if (devToken) {
    params.set("devToken", devToken);
  }

  redirect(`/forgot-password?${params.toString()}`);
}

export async function resetPassword(formData: FormData) {
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
    !user.passwordResetExpiresAt ||
    user.passwordResetExpiresAt < new Date()
  ) {
    redirect("/login?error=This%20password%20reset%20link%20is%20invalid%20or%20expired");
  }

  const membership = await prisma.companyMembership.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    orderBy: { createdAt: "asc" }
  });

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
      companyId: membership?.companyId,
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
