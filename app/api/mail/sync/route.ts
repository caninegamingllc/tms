import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { syncMailboxThreadsForUser } from "@/lib/mail/user-mailbox";

export async function POST() {
  const user = await requireUser();

  try {
    const result = await syncMailboxThreadsForUser(user.id, user.companyId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mailbox sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function GET() {
  return POST();
}
