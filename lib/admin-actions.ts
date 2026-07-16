"use server";

import { randomBytes, createHash } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { appBaseUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { sendInviteEmail } from "@/lib/mail";
import { assignSeat, unassignSeat } from "@/lib/seats";
import { assertPlanFeature } from "@/lib/permissions";
import { setMembershipBranches } from "@/lib/membership-branches";

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

function parseBranchIdsFromForm(formData: FormData) {
  return [
    ...new Set(
      formData
        .getAll("branchIds")
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  ];
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

  if (targetRole === "OWNER" && actorRole !== "OWNER") {
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
  await assertPlanFeature(actor.companyId, "invite_users");
  const email = requiredString(formData, "email").toLowerCase();
  const branchIds = parseBranchIdsFromForm(formData);
  const primaryBranchId = optionalString(formData, "primaryBranchId");
  const role = requiredString(formData, "role");
  const name = requiredString(formData, "name");

  if (role === "OWNER" && actor.role !== "OWNER") {
    redirectWithAdminError("Only an owner can invite another owner.");
  }

  if (branchIds.length === 0 && role !== "OWNER" && role !== "ADMIN") {
    redirectWithAdminError("Select at least one branch for this user.");
  }

  for (const branchId of branchIds) {
    await prisma.branch.findUniqueOrThrow({ where: { id: branchId, companyId: actor.companyId } });
  }

  const resolvedPrimary =
    primaryBranchId && branchIds.includes(primaryBranchId) ? primaryBranchId : branchIds[0] ?? null;

  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const existingMembership = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: user.id, companyId: actor.companyId } }
    });

    if (existingMembership) {
      if (existingMembership.status === "INVITED") {
        redirectWithAdminError(
          "This user already has a pending invite. Use Resend Invite in the users table."
        );
      }

      redirectWithAdminError("This user is already a member of your organization.");
    }
  } else {
    user = await prisma.user.create({
      data: { name, email }
    });
  }

  const token = randomBytes(32).toString("base64url");
  const inviteExpiresAt = new Date();
  inviteExpiresAt.setDate(inviteExpiresAt.getDate() + inviteDays);

  const membership = await prisma.companyMembership.create({
    data: {
      userId: user.id,
      companyId: actor.companyId,
      role,
      status: "INVITED",
      branchId: resolvedPrimary,
      inviteTokenHash: hashInviteToken(token),
      inviteExpiresAt,
      ...(branchIds.length > 0
        ? {
            assignedBranches: {
              create: branchIds.map((branchId) => ({ branchId }))
            }
          }
        : {})
    }
  });

  if (user.name !== name) {
    await prisma.user.update({ where: { id: user.id }, data: { name } });
  }

  await audit(
    actor.companyId,
    actor.id,
    "INVITE_USER",
    "CompanyMembership",
    membership.id,
    `Invited ${email} as ${role}.`,
    user.id
  );
  revalidatePath("/admin");

  const emailResult = await deliverInviteEmail({
    companyId: actor.companyId,
    inviterName: actor.name,
    inviteeName: name,
    email,
    role,
    token
  });

  redirectAfterInvite(token, emailResult.delivered);
}

export async function resendInvite(formData: FormData) {
  const actor = await requireAdmin();
  const membershipId = requiredString(formData, "membershipId");
  const membership = await prisma.companyMembership.findUniqueOrThrow({
    where: { id: membershipId, companyId: actor.companyId },
    include: { user: true }
  });

  if (membership.status !== "INVITED") {
    throw new Error("Only invited users can be re-invited.");
  }

  const token = randomBytes(32).toString("base64url");
  const inviteExpiresAt = new Date();
  inviteExpiresAt.setDate(inviteExpiresAt.getDate() + inviteDays);

  await prisma.companyMembership.update({
    where: { id: membershipId },
    data: {
      inviteTokenHash: hashInviteToken(token),
      inviteExpiresAt
    }
  });

  await audit(
    actor.companyId,
    actor.id,
    "RESEND_INVITE",
    "CompanyMembership",
    membership.id,
    `Re-sent invite to ${membership.user.email}.`,
    membership.userId
  );
  revalidatePath("/admin");

  const emailResult = await deliverInviteEmail({
    companyId: actor.companyId,
    inviterName: actor.name,
    inviteeName: membership.user.name,
    email: membership.user.email,
    role: membership.role,
    token
  });

  redirectAfterInvite(token, emailResult.delivered);
}

export async function cancelInvite(formData: FormData) {
  const actor = await requireAdmin();
  const membershipId = requiredString(formData, "membershipId");
  const membership = await prisma.companyMembership.findUniqueOrThrow({
    where: { id: membershipId, companyId: actor.companyId },
    include: { user: true }
  });

  if (membership.status !== "INVITED") {
    throw new Error("Only invited users can have their invite canceled.");
  }

  await prisma.companyMembership.delete({ where: { id: membershipId } });
  await audit(
    actor.companyId,
    actor.id,
    "CANCEL_INVITE",
    "CompanyMembership",
    membershipId,
    `Canceled invite for ${membership.user.email}.`,
    membership.userId
  );
  revalidatePath("/admin");
}

export async function createAdminUser(formData: FormData) {
  const actor = await requireAdmin();
  const email = requiredString(formData, "email").toLowerCase();
  const password = requiredString(formData, "password");
  const mustChangePassword = formData.get("mustChangePassword") === "on";
  const branchId = optionalString(formData, "branchId");
  const role = requiredString(formData, "role");
  const status = requiredString(formData, "status");
  const name = requiredString(formData, "name");

  if (branchId) {
    await prisma.branch.findUniqueOrThrow({ where: { id: branchId, companyId: actor.companyId } });
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const existing = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: user.id, companyId: actor.companyId } }
    });

    if (existing) {
      throw new Error("This user is already a member of your organization.");
    }
  } else {
    user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        mustChangePassword
      }
    });
  }

  const membership = await prisma.companyMembership.create({
    data: {
      userId: user.id,
      companyId: actor.companyId,
      role,
      status,
      branchId
    }
  });

  await audit(
    actor.companyId,
    actor.id,
    "CREATE_USER",
    "CompanyMembership",
    membership.id,
    `Created ${email} as ${role}.`,
    user.id
  );
  revalidatePath("/admin");
}

export async function updateAdminUser(formData: FormData) {
  const actor = await requireAdmin();
  const membershipId = requiredString(formData, "membershipId");
  const branchIds = parseBranchIdsFromForm(formData);
  const primaryBranchId = optionalString(formData, "primaryBranchId");
  const role = requiredString(formData, "role");
  const status = requiredString(formData, "status");
  const name = requiredString(formData, "name");

  const target = await prisma.companyMembership.findUniqueOrThrow({
    where: { id: membershipId, companyId: actor.companyId },
    include: { user: true }
  });

  if (target.userId === actor.id && role !== target.role) {
    throw new Error("You cannot change your own role.");
  }

  assertCanManageTarget(actor.role, target.role, target.userId, actor.id);

  if (role === "OWNER" && actor.role !== "OWNER") {
    throw new Error("Only an owner can assign the owner role.");
  }

  if (branchIds.length === 0 && role !== "OWNER" && role !== "ADMIN") {
    throw new Error("Select at least one branch for this user.");
  }

  await prisma.user.update({
    where: { id: target.userId },
    data: { name }
  });

  await setMembershipBranches(membershipId, actor.companyId, branchIds, primaryBranchId);

  const membership = await prisma.companyMembership.update({
    where: { id: membershipId },
    data: { role, status }
  });

  await audit(
    actor.companyId,
    actor.id,
    "UPDATE_USER",
    "CompanyMembership",
    membership.id,
    `Updated ${target.user.email}.`,
    target.userId
  );
  revalidatePath("/admin");
}

export async function resetUserPassword(formData: FormData) {
  const actor = await requireAdmin();
  const userId = requiredString(formData, "userId");
  const password = requiredString(formData, "newPassword");

  await prisma.companyMembership.findFirstOrThrow({
    where: { userId, companyId: actor.companyId }
  });

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
  await audit(
    actor.companyId,
    actor.id,
    "RESET_PASSWORD",
    "User",
    user.id,
    `Reset password for ${user.email}.`,
    user.id
  );
  revalidatePath("/admin");
}

export async function setUserLock(formData: FormData) {
  const actor = await requireAdmin();
  const membershipId = requiredString(formData, "membershipId");
  const mode = requiredString(formData, "mode");
  const locked = mode === "lock";

  const target = await prisma.companyMembership.findUniqueOrThrow({
    where: { id: membershipId, companyId: actor.companyId },
    include: { user: true }
  });

  if (target.userId === actor.id && locked) {
    throw new Error("You cannot lock your own account.");
  }

  const membership = await prisma.companyMembership.update({
    where: { id: membershipId },
    data: {
      lockedAt: locked ? new Date() : null,
      status: locked ? "LOCKED" : "ACTIVE"
    }
  });

  if (locked) {
    await prisma.session.deleteMany({ where: { userId: target.userId } });
  }

  await audit(
    actor.companyId,
    actor.id,
    locked ? "LOCK_USER" : "UNLOCK_USER",
    "CompanyMembership",
    membership.id,
    `${locked ? "Locked" : "Unlocked"} ${target.user.email}.`,
    target.userId
  );
  revalidatePath("/admin");
}

export async function setUserDisabled(formData: FormData) {
  const actor = await requireAdmin();
  const membershipId = requiredString(formData, "membershipId");
  const mode = requiredString(formData, "mode");
  const disabled = mode === "disable";

  const target = await prisma.companyMembership.findUniqueOrThrow({
    where: { id: membershipId, companyId: actor.companyId },
    include: { user: true }
  });

  if (target.role === "OWNER" && actor.role !== "OWNER") {
    throw new Error("Only an owner can disable owner accounts.");
  }

  if (target.userId === actor.id && disabled) {
    throw new Error("You cannot disable your own account.");
  }

  const membership = await prisma.companyMembership.update({
    where: { id: membershipId },
    data: {
      disabledAt: disabled ? new Date() : null,
      status: disabled ? "DISABLED" : "ACTIVE"
    }
  });

  if (disabled) {
    await prisma.session.deleteMany({ where: { userId: target.userId } });
  }

  await audit(
    actor.companyId,
    actor.id,
    disabled ? "DISABLE_USER" : "ENABLE_USER",
    "CompanyMembership",
    membership.id,
    `${disabled ? "Disabled" : "Enabled"} ${target.user.email}.`,
    target.userId
  );
  revalidatePath("/admin");
}

export async function forcePasswordChange(formData: FormData) {
  const actor = await requireAdmin();
  const userId = requiredString(formData, "userId");
  const force = requiredString(formData, "mode") === "force";

  await prisma.companyMembership.findFirstOrThrow({
    where: { userId, companyId: actor.companyId }
  });

  const user = await prisma.user.update({
    where: { id: userId },
    data: { mustChangePassword: force }
  });

  await audit(
    actor.companyId,
    actor.id,
    force ? "FORCE_PASSWORD_CHANGE" : "CLEAR_PASSWORD_CHANGE",
    "User",
    user.id,
    `${force ? "Required" : "Cleared required"} password change for ${user.email}.`,
    user.id
  );
  revalidatePath("/admin");
}

export async function assignSeatToMember(formData: FormData) {
  const actor = await requireAdmin();
  const membershipId = requiredString(formData, "membershipId");

  try {
    const { refreshSeatSubscriptionFromStripe } = await import("@/lib/billing-actions");
    await refreshSeatSubscriptionFromStripe(actor.companyId, { force: true });

    const membership = await assignSeat(membershipId, actor.companyId);

    await audit(
      actor.companyId,
      actor.id,
      "ASSIGN_SEAT",
      "CompanyMembership",
      membership.id,
      `Assigned seat to membership ${membership.id}.`,
      membership.userId
    );
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Failed to assign seat";
    redirect(`/admin?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/billing");
}

export async function unassignSeatFromMember(formData: FormData) {
  const actor = await requireAdmin();
  const membershipId = requiredString(formData, "membershipId");

  try {
    const membership = await unassignSeat(membershipId, actor.companyId);

    await audit(
      actor.companyId,
      actor.id,
      "UNASSIGN_SEAT",
      "CompanyMembership",
      membership.id,
      `Unassigned seat from membership ${membership.id}.`,
      membership.userId
    );
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Failed to unassign seat";
    redirect(`/admin?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/billing");
}

export async function createBranch(formData: FormData) {
  const actor = await requireAdmin();
  await assertPlanFeature(actor.companyId, "multi_branch");

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
    prisma.membershipBranch.deleteMany({ where: { branchId } }),
    prisma.companyMembership.updateMany({ where: { branchId }, data: { branchId: null } }),
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

async function assertUserCanBeDeleted(userId: string) {
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

async function assertNotLastOwner(companyId: string, membershipId: string, role: string) {
  if (role !== "OWNER") {
    return;
  }

  const ownerCount = await prisma.companyMembership.count({
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
  const membershipId = requiredString(formData, "membershipId");
  const target = await prisma.companyMembership.findUniqueOrThrow({
    where: { id: membershipId, companyId: actor.companyId },
    include: { user: true }
  });

  if (target.status === "INVITED") {
    throw new Error("Use cancel invite for invited users.");
  }

  if (target.userId === actor.id) {
    throw new Error("You cannot delete your own account.");
  }

  assertCanManageTarget(actor.role, target.role, target.userId, actor.id);
  await assertNotLastOwner(actor.companyId, membershipId, target.role);

  const otherMemberships = await prisma.companyMembership.count({
    where: { userId: target.userId, id: { not: membershipId } }
  });

  if (otherMemberships === 0) {
    await assertUserCanBeDeleted(target.userId);
  }

  await audit(
    actor.companyId,
    actor.id,
    "DELETE_USER",
    "CompanyMembership",
    membershipId,
    `Removed ${target.user.email} from organization.`,
    target.userId
  );

  await prisma.$transaction(async (tx) => {
    await tx.companyMembership.delete({ where: { id: membershipId } });

    if (otherMemberships === 0) {
      await tx.auditLog.updateMany({ where: { actorUserId: target.userId }, data: { actorUserId: null } });
      await tx.auditLog.updateMany({ where: { targetUserId: target.userId }, data: { targetUserId: null } });
      await tx.user.delete({ where: { id: target.userId } });
    }
  });

  revalidatePath("/admin");
}

export async function updateLoadNumberSettings(formData: FormData) {
  const actor = await requireAdmin();
  const prefix = String(formData.get("loadNumberPrefix") ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
  const nextLoadSequence = Number(formData.get("nextLoadSequence"));

  if (!Number.isInteger(nextLoadSequence) || nextLoadSequence < 1) {
    throw new Error("Next load number must be a positive whole number.");
  }

  const nextAutoLoadNumber = prefix
    ? `${prefix}-${String(nextLoadSequence).padStart(4, "0")}`
    : String(nextLoadSequence).padStart(4, "0");

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
    `Set next auto load number to ${nextAutoLoadNumber}.`
  );
  revalidatePath("/admin");
  revalidatePath("/loads/new");
}

const LOGO_MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

function resolveLogoFile(file: File) {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (allowed.has(file.type)) {
    return file;
  }

  const ext = file.name.includes(".")
    ? `.${file.name.split(".").pop()!.toLowerCase()}`
    : "";
  const inferred = LOGO_MIME_BY_EXT[ext];
  if (!inferred) {
    throw new Error("Logo must be a JPEG, PNG, or WebP image.");
  }

  // Some browsers send an empty Content-Type; infer from extension so storage validation passes.
  return new File([file], file.name, { type: inferred, lastModified: file.lastModified });
}

export async function updateCompanyBranding(formData: FormData) {
  const actor = await requireAdmin();

  try {
    const { deleteStoredFile, saveUploadedFile } = await import("@/lib/document-storage");

    const company = await prisma.company.findUniqueOrThrow({ where: { id: actor.companyId } });
    const removeLogo = formData.get("removeLogo") === "on";
    const logoFile = formData.get("logo");

    let logoFilePath = company.logoFilePath;
    let logoMimeType = company.logoMimeType;
    let logoOriginalFileName = company.logoOriginalFileName;

    if (removeLogo) {
      await deleteStoredFile(company.logoFilePath);
      logoFilePath = null;
      logoMimeType = null;
      logoOriginalFileName = null;
    } else if (logoFile instanceof File && logoFile.size > 0) {
      const normalizedLogo = resolveLogoFile(logoFile);
      const stored = await saveUploadedFile(actor.companyId, normalizedLogo);
      await deleteStoredFile(company.logoFilePath);
      logoFilePath = stored.storedPath;
      logoMimeType = stored.mimeType;
      logoOriginalFileName = stored.originalFileName;
    }

    await prisma.company.update({
      where: { id: actor.companyId },
      data: {
        address: optionalString(formData, "address") ?? null,
        city: optionalString(formData, "city") ?? null,
        state: optionalString(formData, "state")?.toUpperCase() ?? null,
        postalCode: optionalString(formData, "postalCode") ?? null,
        phone: optionalString(formData, "phone") ?? null,
        email: optionalString(formData, "email") ?? null,
        website: optionalString(formData, "website") ?? null,
        customerPaymentUrl: optionalString(formData, "customerPaymentUrl") ?? null,
        logoFilePath,
        logoMimeType,
        logoOriginalFileName
      }
    });

    await audit(
      actor.companyId,
      actor.id,
      "UPDATE_COMPANY_BRANDING",
      "Company",
      actor.companyId,
      "Updated organization branding and letterhead."
    );
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Failed to update branding";
    redirect(`/admin?tab=settings&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin");
  redirect("/admin?tab=settings");
}
