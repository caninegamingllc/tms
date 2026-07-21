"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeDisplayName, validateDisplayName } from "@/lib/profile";

export async function updateOwnProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const rawName = String(formData.get("name") ?? "");
  const nameError = validateDisplayName(rawName);
  if (nameError) {
    redirect(`/profile?error=${encodeURIComponent(nameError)}`);
  }

  const name = normalizeDisplayName(rawName);

  await prisma.user.update({
    where: { id: user.id },
    data: { name }
  });

  await prisma.auditLog.create({
    data: {
      companyId: user.companyId,
      actorUserId: user.id,
      targetUserId: user.id,
      action: "UPDATE_OWN_PROFILE",
      entityType: "User",
      entityId: user.id,
      details: "User updated their display name."
    }
  });

  revalidatePath("/profile");
  revalidatePath("/");
  redirect("/profile?updated=1");
}
