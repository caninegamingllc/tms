import { redirect } from "next/navigation";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const user = await getCurrentUser();
  await destroySession();

  if (user) {
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "LOGOUT",
        entityType: "User",
        entityId: user.id,
        details: "User signed out."
      }
    });
  }

  redirect("/login");
}
