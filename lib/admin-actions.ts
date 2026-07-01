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

async function audit(
  companyId: string,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId?: string,
  details?: string,
  targetUserId?: string
) {
  await prisma.auditLog.create({
    data: {
      companyId,
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
  const branchId = optionalString(formData, "branchId");

  if (branchId) {
    await prisma.branch.findUniqueOrThrow({ where: { id: branchId, companyId: actor.companyId } });
  }

  const user = await prisma.user.create({
    data: {
      companyId: actor.companyId,
      name: requiredString(formData, "name"),
      email,
      role: requiredString(formData, "role"),
      status: requiredString(formData, "status"),
      branchId,
      passwordHash: await hashPassword(password),
      mustChangePassword
    }
  });

  await audit(actor.companyId, actor.id, "CREATE_USER", "User", user.id, `Created ${user.email} as ${user.role}.`, user.id);
  revalidatePath("/admin");
}

export async function updateAdminUser(formData: FormData) {
  const actor = await requireAdmin();
  const userId = requiredString(formData, "userId");
  const branchId = optionalString(formData, "branchId");
  await prisma.user.findUniqueOrThrow({ where: { id: userId, companyId: actor.companyId } });

  if (branchId) {
    await prisma.branch.findUniqueOrThrow({ where: { id: branchId, companyId: actor.companyId } });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: requiredString(formData, "name"),
      role: requiredString(formData, "role"),
      branchId,
      status: requiredString(formData, "status")
    }
  });

  await audit(actor.companyId, actor.id, "UPDATE_USER", "User", user.id, `Updated ${user.email}.`, user.id);
  revalidatePath("/admin");
}

export async function resetUserPassword(formData: FormData) {
  const actor = await requireAdmin();
  const userId = requiredString(formData, "userId");
  const password = requiredString(formData, "newPassword");
  await prisma.user.findUniqueOrThrow({ where: { id: userId, companyId: actor.companyId } });

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
  await audit(actor.companyId, actor.id, "RESET_PASSWORD", "User", user.id, `Reset password for ${user.email}.`, user.id);
  revalidatePath("/admin");
}

export async function setUserLock(formData: FormData) {
  const actor = await requireAdmin();
  const userId = requiredString(formData, "userId");
  const mode = requiredString(formData, "mode");
  const locked = mode === "lock";
  await prisma.user.findUniqueOrThrow({ where: { id: userId, companyId: actor.companyId } });

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

  await audit(actor.companyId, actor.id, locked ? "LOCK_USER" : "UNLOCK_USER", "User", user.id, `${locked ? "Locked" : "Unlocked"} ${user.email}.`, user.id);
  revalidatePath("/admin");
}

export async function setUserDisabled(formData: FormData) {
  const actor = await requireAdmin();
  const userId = requiredString(formData, "userId");
  const mode = requiredString(formData, "mode");
  const disabled = mode === "disable";
  await prisma.user.findUniqueOrThrow({ where: { id: userId, companyId: actor.companyId } });

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

  await audit(actor.companyId, actor.id, disabled ? "DISABLE_USER" : "ENABLE_USER", "User", user.id, `${disabled ? "Disabled" : "Enabled"} ${user.email}.`, user.id);
  revalidatePath("/admin");
}

export async function forcePasswordChange(formData: FormData) {
  const actor = await requireAdmin();
  const userId = requiredString(formData, "userId");
  const force = requiredString(formData, "mode") === "force";
  await prisma.user.findUniqueOrThrow({ where: { id: userId, companyId: actor.companyId } });

  const user = await prisma.user.update({
    where: { id: userId },
    data: { mustChangePassword: force }
  });

  await audit(actor.companyId, actor.id, force ? "FORCE_PASSWORD_CHANGE" : "CLEAR_PASSWORD_CHANGE", "User", user.id, `${force ? "Required" : "Cleared required"} password change for ${user.email}.`, user.id);
  revalidatePath("/admin");
}

export async function createBranch(formData: FormData) {
  const actor = await requireAdmin();

  const branch = await prisma.branch.create({
    data: {
      companyId: actor.companyId,
      name: requiredString(formData, "name"),
      city: optionalString(formData, "city"),
      state: optionalString(formData, "state")
    }
  });

  await audit(actor.companyId, actor.id, "CREATE_BRANCH", "Branch", branch.id, `Created branch ${branch.name}.`);
  revalidatePath("/admin");
}

export async function updateLoadNumberSettings(formData: FormData) {
  const actor = await requireAdmin();
  const prefix = requiredString(formData, "loadNumberPrefix").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const nextLoadSequence = Number(formData.get("nextLoadSequence"));

  if (!prefix) {
    throw new Error("Load number prefix is required.");
  }

  if (!Number.isInteger(nextLoadSequence) || nextLoadSequence < 1) {
    throw new Error("Next load number must be a positive whole number.");
  }

  await prisma.company.update({
    where: { id: actor.companyId },
    data: {
      loadNumberPrefix: prefix,
      nextLoadSequence
    }
  });

  await audit(
    actor.companyId,
    actor.id,
    "UPDATE_LOAD_NUMBER_SETTINGS",
    "Company",
    actor.companyId,
    `Set next auto load number to ${prefix}-${nextLoadSequence}.`
  );
  revalidatePath("/admin");
  revalidatePath("/loads/new");
}
