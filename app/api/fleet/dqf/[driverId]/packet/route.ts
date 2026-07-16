import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { driverDisplayName } from "@/lib/fleet-constants";
import { formatDate } from "@/lib/format";
import { planHasFeature, upgradePathMessage } from "@/lib/plans";

export async function GET(
  _request: Request,
  context: { params: Promise<{ driverId: string }> }
) {
  const user = await requireUser();
  if (!planHasFeature(user.plan, "driver_qualification")) {
    return NextResponse.json(
      { error: upgradePathMessage("driver_qualification", user.plan) },
      { status: 403 }
    );
  }

  const { driverId } = await context.params;

  const driver = await prisma.driver.findFirst({
    where: { id: driverId, companyId: user.companyId },
    include: {
      qualificationItems: { orderBy: [{ category: "asc" }, { createdAt: "asc" }] }
    }
  });

  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  const lines = [
    "DRIVER QUALIFICATION FILE PACKET",
    `Company: ${user.companyName}`,
    `Driver: ${driverDisplayName(driver)}`,
    `Employee #: ${driver.employeeNumber ?? "—"}`,
    `CDL: ${driver.cdlNumber ?? "—"} (${driver.cdlClass ?? "—"} / ${driver.cdlState ?? "—"})`,
    `CDL expires: ${formatDate(driver.cdlExpiresAt)}`,
    `Medical expires: ${formatDate(driver.medicalExpiresAt)}`,
    `Generated: ${formatDate(new Date())}`,
    "",
    "=== QUALIFICATION CHECKLIST ===",
    ...driver.qualificationItems.map((item) => {
      return [
        `- [${item.status}] ${item.title} (${item.category})`,
        `  Issued: ${formatDate(item.issuedAt)} | Expires: ${formatDate(item.expiresAt)}`,
        `  File: ${item.originalFileName ?? "none"}`,
        item.notes ? `  Notes: ${item.notes}` : null
      ]
        .filter(Boolean)
        .join("\n");
    }),
    "",
    "Download individual document uploads from the driver DQF screen.",
    "This summary is suitable as an audit cover sheet."
  ].join("\n");

  return new NextResponse(lines, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="dqf-${driver.lastName}-${driver.id}.txt"`
    }
  });
}
