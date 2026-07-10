import { redirect } from "next/navigation";
import { canWrite } from "@/lib/scope";

export { canWrite, canManageUsers } from "@/lib/scope";

export async function requireWriteUser() {
  const { requireUser } = await import("@/lib/auth");
  const user = await requireUser();

  if (!canWrite(user)) {
    redirect("/?error=You%20do%20not%20have%20permission%20to%20modify%20data");
  }

  return user;
}
