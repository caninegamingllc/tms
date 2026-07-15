import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { enqueueJob } from "@/lib/jobs";

export async function POST() {
  const user = await requireUser();

  try {
    const job = await enqueueJob("SYNC_MAILBOX", {
      userId: user.id,
      companyId: user.companyId
    });
    return NextResponse.json({ ok: true, queued: true, jobId: job.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mailbox sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function GET() {
  return POST();
}
