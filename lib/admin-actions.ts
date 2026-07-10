"use server";

import { randomBytes, createHash } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { appBaseUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { sendInviteEmail } from "@/lib/mail";

const inviteDays = 7;

function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

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

function assertCanManageTarget(actorRole: string, targetRole: string, targetId: string, actorId: string) {
  if (targetId === actorId && targetRole !== actorRole) {
    throw new Error("You cannot change your own role.");
  }

  if (targetRole === "OWNER" && actorRole !== "OWNER") {
    throw new Error("Only an owner can manage owner accounts.");
  }

  const nextRole = targetRole;
  if (nextRole === "OWNER" && actorRole !== "OWNER") {
    throw new Error("Only an owner can assign the owner role.");
  }
}

async function deliverInviteEmail(params: {
  companyId: string;
  inviterName: string;
  inviteeName: string;
  email: string;
  role: string;
  token: string;
}) {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: params.companyId } });
  const inviteUrl = `${appBaseUrl()}/accept-invite?token=${encodeURIComponent(params.token)}`;

  try {
    return await sendInviteEmail(params.email, {
      inviteUrl,
      companyName: company.name,
      inviterName: params.inviterName,
      inviteeName: params.inviteeName,
      role: params.role,
      expiresInDays: inviteDays
    });
  } catch (error) {
    console.error("[invite] email delivery failed:", error);
    return { delivered: false };
  }
}

function redirectAfterInvite(token: string, delivered: boolean) {
  const params = new URLSearchParams({
    invite: `/accept-invite?token=${token}`
  });

  if (delivered) {
    params.set("emailSent", "1");
  }

  redirect(`/admin?${params.toString()}`);
}

function redirectWithAdminError(message: string) {
  redirect(`/admin?error=${encodeURIComponent(message)}`);
}

export async function inviteUser(formData: FormData) {
  const actor = await requireAdmin();
  const email = requiredString(formData, "email").toLowerCase();
  const branchId = requiredString(formData, "branchId");
  const role = requiredString(formData, "role");

  if (role === "OWNER" && actor.role !== "OWNER") {
    redirectWithAdminError("Only an owner can invite another owner.");
  }

  if (branchId) {
    await prisma.branch.findUniqueOrThrow({ where: { id: branchId, companyId: actor.companyId } });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.companyId === actor.companyId && existing.status === "INVITED") {
      redirectWithAdminError(
        "This user already has a pending invite. Use Resend Invite in the users table."
      );
    }

    redirectWithAdminError("An account already exists for that email.");
  }

  const token = randomBytes(32).toString("base64url");
  const inviteExpiresAt = new Date();
  inviteExpiresAt.setDate(inviteExpiresAt.getDate() + inviteDays);

  const user = await prisma.user.create({
    data: {
      companyId: actor.companyId,
      name: requiredString(formData, "name"),
      email,
      role,
      status: "INVITED",
      branchId,
      inviteTokenHash: hashInviteToken(token),
      inviteExpiresAt
    }
  });

  await audit(
    actor.companyId,
    actor.id,
    "INVITE_USER",
    "User",
    user.id,
    `Invited ${user.email} as ${user.role}.`,
    user.id
  );
  revalidatePath("/admin");

  const emailResult = await deliverInviteEmail({
    companyId: actor.companyId,
    inviterName: actor.name,
    inviteeName: user.name,
    email: user.email,
    role: user.role,
    token
  });

  redirectAfterInvite(token, emailResult.delivered);
}

export async function resendInvite(formData: FormData) {
  const actor = await requireAdmin();
  const userId = requiredString(formData, "userId");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId, companyId: actor.companyId } });

  if (user.status !== "INVITED") {
    throw new Error("Only invited users can be re-invited.");
  }

  const token = randomBytes(32).toString("base64url");
  const inviteExpiresAt = new Date();
  inviteExpiresAt.setDate(inviteExpiresAt.getDate() + inviteDays);

  await prisma.user.update({
    where: { id: userId },
    data: {
      inviteTokenHash: hashInviteToken(token),
      inviteExpiresAt
    }
  });

  await audit(actor.companyId, actor.id, "RESEND_INVITE", "User", user.id, `Re-sent invite to ${user.email}.`, user.id);
  revalidatePath("/admin");

  const emailResult = await deliverInviteEmail({
    companyId: actor.companyId,
    inviterName: actor.name,
    inviteeName: user.name,
    email: user.email,
    role: user.role,
    token
  });

  redirectAfterInvite(token, emailResult.delivered);
}

export async function cancelInvite(formData: FormData) {
  const actor = await requireAdmin();
  const userId = requiredString(formData, "userId");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId, companyId: actor.companyId } });

  if (user.status !== "INVITED") {
    throw new Error("Only invited users can have their invite canceled.");
  }

  await prisma.user.delete({ where: { id: userId } });
  await audit(actor.companyId, actor.id, "CANCEL_INVITE", "User", userId, `Canceled invite for ${user.email}.`, userId);
  revalidatePath("/admin");
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
  const role = requiredString(formData, "role");
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId, companyId: actor.companyId } });

  if (userId === actor.id && role !== target.role) {
    throw new Error("You cannot change your own role.");
  }

  assertCanManageTarget(actor.role, target.role, userId, actor.id);

  if (role === "OWNER" && actor.role !== "OWNER") {
    throw new Error("Only an owner can assign the owner role.");
  }

  if (branchId) {
    await prisma.branch.findUniqueOrThrow({ where: { id: branchId, companyId: actor.companyId } });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: requiredString(formData, "name"),
      role,
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
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId, companyId: actor.companyId } });

  if (target.role === "OWNER" && actor.role !== "OWNER") {
    throw new Error("Only an owner can disable owner accounts.");
  }

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

async function assertBranchCanBeDeleted(companyId: string, branchId: string) {
  const [loadCount, customerCount] = await Promise.all([
    prisma.load.count({ where: { companyId, branchId } }),
    prisma.customer.count({ where: { companyId, branchId } })
  ]);

  if (loadCount > 0 || customerCount > 0) {
    const parts: string[] = [];
    if (loadCount > 0) {
      parts.push(`${loadCount} load${loadCount === 1 ? "" : "s"}`);
    }
    if (customerCount > 0) {
      parts.push(`${customerCount} customer${customerCount === 1 ? "" : "s"}`);
    }
    throw new Error(`This branch cannot be deleted because it is assigned to ${parts.join(" and ")}.`);
  }
}

export async function deleteBranch(formData: FormData) {
  const actor = await requireAdmin();
  const branchId = requiredString(formData, "branchId");
  const branch = await prisma.branch.findUniqueOrThrow({
    where: { id: branchId, companyId: actor.companyId }
  });

  await assertBranchCanBeDeleted(actor.companyId, branchId);

  await prisma.$transaction([
    prisma.user.updateMany({ where: { branchId }, data: { branchId: null } }),
    prisma.carrier.updateMany({ where: { branchId }, data: { branchId: null } }),
    prisma.facility.updateMany({ where: { branchId }, data: { branchId: null } }),
    prisma.branch.delete({ where: { id: branchId } })
  ]);

  await audit(
    actor.companyId,
    actor.id,
    "DELETE_BRANCH",
    "Branch",
    branchId,
    `Deleted branch ${branch.name}.`
  );
  revalidatePath("/admin");
}

async function assertUserCanBeDeleted(companyId: string, userId: string) {
  const [noteCount, activityCount] = await Promise.all([
    prisma.loadNote.count({ where: { userId } }),
    prisma.loadActivity.count({ where: { userId } })
  ]);

  if (noteCount > 0 || activityCount > 0) {
    const parts: string[] = [];
    if (noteCount > 0) {
      parts.push(`${noteCount} load note${noteCount === 1 ? "" : "s"}`);
    }
    if (activityCount > 0) {
      parts.push(`${activityCount} load activit${activityCount === 1 ? "y" : "ies"}`);
    }
    throw new Error(`This user cannot be deleted because they are linked to ${parts.join(" and ")}.`);
  }
}

async function assertNotLastOwner(companyId: string, userId: string, role: string) {
  if (role !== "OWNER") {
    return;
  }

  const ownerCount = await prisma.user.count({
    where: {
      companyId,
      role: "OWNER",
      status: { not: "INVITED" }
    }
  });

  if (ownerCount <= 1) {
    throw new Error("You cannot delete the last owner account.");
  }
}

export async function deleteUser(formData: FormData) {
  const actor = await requireAdmin();
  const userId = requiredString(formData, "userId");
  const target = await prisma.user.findUniqueOrThrow({
    where: { id: userId, companyId: actor.companyId }
  });

  if (target.status === "INVITED") {
    throw new Error("Use cancel invite for invited users.");
  }

  if (actor.id === userId) {
    throw new Error("You cannot delete your own account.");
  }

  assertCanManageTarget(actor.role, target.role, userId, actor.id);
  await assertNotLastOwner(actor.companyId, userId, target.role);
  await assertUserCanBeDeleted(actor.companyId, userId);

  await audit(
    actor.companyId,
    actor.id,
    "DELETE_USER",
    "User",
    userId,
    `Deleted user ${target.email}.`,
    userId
  );

  await prisma.$transaction([
    prisma.auditLog.updateMany({ where: { actorUserId: userId }, data: { actorUserId: null } }),
    prisma.auditLog.updateMany({ where: { targetUserId: userId }, data: { targetUserId: null } }),
    prisma.user.delete({ where: { id: userId } })
  ]);

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
