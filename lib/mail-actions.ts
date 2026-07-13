"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { disconnectUserMailbox, syncMailboxThreadsForUser } from "@/lib/mail/user-mailbox";
import { parseOAuthProvider } from "@/lib/oauth/types";

export async function disconnectMailbox(formData: FormData) {
  const user = await requireUser();
  const provider = parseOAuthProvider(String(formData.get("provider") ?? ""));
  if (!provider) {
    throw new Error("Unsupported provider");
  }

  await disconnectUserMailbox(user.id, provider);
  revalidatePath("/settings/email");
}

export async function syncMyMailbox() {
  const user = await requireUser();
  await syncMailboxThreadsForUser(user.id, user.companyId);
  revalidatePath("/settings/email");
  revalidatePath("/loads");
}
