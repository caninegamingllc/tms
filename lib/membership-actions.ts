"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, requireUser } from "@/lib/auth";
import { clearBranchFilterCookie } from "@/lib/branch-filter-actions";
import { prisma } from "@/lib/db";

export async function switchOrganization(formData: FormData) {
  const user = await requireUser();
  const membershipId = String(formData.get("membershipId") ?? "").trim();

  if (!membershipId) {
    throw new Error("membershipId is required");
  }

  const membership = await prisma.companyMembership.findFirst({
    where: {
      id: membershipId,
      userId: user.id,
      status: "ACTIVE",
      lockedAt: null,
      disabledAt: null,
      company: { status: "ACTIVE" }
    }
  });

  if (!membership) {
    throw new Error("Organization not found or not accessible.");
  }

  await prisma.session.deleteMany({ where: { userId: user.id } });
  await clearBranchFilterCookie();
  await createSession(user.id, membershipId);

  revalidatePath("/", "layout");
  redirect("/");
}

export async function selectOrganization(formData: FormData) {
  const user = await requireUser();
  const membershipId = String(formData.get("membershipId") ?? "").trim();

  if (!membershipId) {
    redirect("/select-organization?error=Please%20select%20an%20organization");
  }

  const membership = await prisma.companyMembership.findFirst({
    where: {
      id: membershipId,
      userId: user.id,
      status: "ACTIVE",
      lockedAt: null,
      disabledAt: null,
      company: { status: "ACTIVE" }
    },
    include: { company: true }
  });

  if (!membership) {
    redirect("/select-organization?error=Organization%20not%20found");
  }

  await prisma.session.deleteMany({ where: { userId: user.id } });
  await clearBranchFilterCookie();
  await createSession(user.id, membershipId);

  await prisma.auditLog.create({
    data: {
      companyId: membership.companyId,
      actorUserId: user.id,
      action: "SELECT_ORGANIZATION",
      entityType: "CompanyMembership",
      entityId: membership.id,
      details: `Selected organization ${membership.company.name}.`
    }
  });

  redirect("/");
}
