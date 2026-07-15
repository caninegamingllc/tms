import { cache } from "react";
import { redirect } from "next/navigation";
import { canAccessAdmin, canAccessTms } from "@/lib/seats";
import { canWrite } from "@/lib/scope";

export { canWrite, canManageUsers } from "@/lib/scope";

function redirectIfNoSeat(user: { hasSeat: boolean; role: string }) {
  if (!canAccessTms({ seatAssignedAt: user.hasSeat ? new Date() : null })) {
    if (canAccessAdmin(user.role)) {
      redirect("/admin/billing?needsSeat=1");
    }

    redirect("/select-organization?error=You%20need%20a%20seat%20assigned%20to%20access%20this%20organization");
  }
}

export async function requireWriteUser() {
  const { requireUser } = await import("@/lib/auth");
  const user = await requireUser();

  if (!canWrite(user)) {
    redirect("/?error=You%20do%20not%20have%20permission%20to%20modify%20data");
  }

  redirectIfNoSeat(user);

  return user;
}

export const requireTmsAccess = cache(async () => {
  const { requireUser } = await import("@/lib/auth");
  const user = await requireUser();

  redirectIfNoSeat(user);

  return user;
});
