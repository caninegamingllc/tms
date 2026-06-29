"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || undefined;
}

async function audit(actorUserId: string, action: string, entityType: string, entityId?: string, details?: string, targetUserId?: string) {
  await prisma.auditLog.create({
    data: {
      actorUserId,
      targetUserId,
      action,
      entityType,
      entityId,
      details
    }
  });
}

export async function createAdminUser(formData: FormData) {
  const actor = await requireAdmin();
  const email = requiredString(formData, "email").toLowerCase();
  const password = requiredString(formData, "password");
  const mustChangePassword = formData.get("mustChangePassword") === "on";

  const user = await prisma.user.create({
    data: {
      name: requiredString(formData, "name"),
      email,
      role: requiredString(formData, "role"),
      status: requiredString(formData, "status"),
      branchId: optionalString(formData, "branchId"),
      passwordHash: await hashPassword(password),
      mustChangePassword
    }
  });

  await audit(actor.id, "CREATE_USER", "User", user.id, `Created ${user.email} as ${user.role}.`, user.id);
  revalidatePath("/admin");
}

export async function updateAdminUser(formData: FormData) {
  const actor = await requireAdmin();
  const userId = requiredString(formData, "userId");

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: requiredString(formData, "name"),
      role: requiredString(formData, "role"),
      branchId: optionalString(formData, "branchId"),
      status: requiredString(formData, "status")
    }
  });

  await audit(actor.id, "UPDATE_USER", "User", user.id, `Updated ${user.email}.`, user.id);
  revalidatePath("/admin");
}

export async function resetUserPassword(formData: FormData) {
  const actor = await requireAdmin();
  const userId = requiredString(formData, "userId");
  const password = requiredString(formData, "newPassword");

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      passwordResetAt: new Date()
    }
  });

  await prisma.session.deleteMany({ where: { userId } });
  await audit(actor.id, "RESET_PASSWORD", "User", user.id, `Reset password for ${user.email}.`, user.id);
  revalidatePath("/admin");
}

export async function setUserLock(formData: FormData) {
  const actor = await requireAdmin();
  const userId = requiredString(formData, "userId");
  const mode = requiredString(formData, "mode");
  const locked = mode === "lock";

  if (actor.id === userId && locked) {
    throw new Error("You cannot lock your own account.");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      lockedAt: locked ? new Date() : null,
      status: locked ? "LOCKED" : "ACTIVE"
    }
  });

  if (locked) {
    await prisma.session.deleteMany({ where: { userId } });
  }

  await audit(actor.id, locked ? "LOCK_USER" : "UNLOCK_USER", "User", user.id, `${locked ? "Locked" : "Unlocked"} ${user.email}.`, user.id);
  revalidatePath("/admin");
}

export async function setUserDisabled(formData: FormData) {
  const actor = await requireAdmin();
  const userId = requiredString(formData, "userId");
  const mode = requiredString(formData, "mode");
  const disabled = mode === "disable";

  if (actor.id === userId && disabled) {
    throw new Error("You cannot disable your own account.");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      disabledAt: disabled ? new Date() : null,
      status: disabled ? "DISABLED" : "ACTIVE"
    }
  });

  if (disabled) {
    await prisma.session.deleteMany({ where: { userId } });
  }

  await audit(actor.id, disabled ? "DISABLE_USER" : "ENABLE_USER", "User", user.id, `${disabled ? "Disabled" : "Enabled"} ${user.email}.`, user.id);
  revalidatePath("/admin");
}

export async function forcePasswordChange(formData: FormData) {
  const actor = await requireAdmin();
  const userId = requiredString(formData, "userId");
  const force = requiredString(formData, "mode") === "force";

  const user = await prisma.user.update({
    where: { id: userId },
    data: { mustChangePassword: force }
  });

  await audit(actor.id, force ? "FORCE_PASSWORD_CHANGE" : "CLEAR_PASSWORD_CHANGE", "User", user.id, `${force ? "Required" : "Cleared required"} password change for ${user.email}.`, user.id);
  revalidatePath("/admin");
}

export async function createBranch(formData: FormData) {
  const actor = await requireAdmin();

  const branch = await prisma.branch.create({
    data: {
      name: requiredString(formData, "name"),
      city: optionalString(formData, "city"),
      state: optionalString(formData, "state")
    }
  });

  await audit(actor.id, "CREATE_BRANCH", "Branch", branch.id, `Created branch ${branch.name}.`);
  revalidatePath("/admin");
}
