import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildIftaWorksheet, formatIftaWorksheetText } from "@/lib/ifta-worksheet";
import { planHasFeature, upgradePathMessage } from "@/lib/plans";

export async function GET(
  _request: Request,
  context: { params: Promise<{ quarterId: string }> }
) {
  const user = await requireUser();
  if (!planHasFeature(user.plan, "fuel_tax_ifta")) {
    return NextResponse.json(
      { error: upgradePathMessage("fuel_tax_ifta", user.plan) },
      { status: 403 }
    );
  }

  const { quarterId } = await context.params;
  const quarter = await prisma.iftaQuarter.findFirst({
    where: { id: quarterId, companyId: user.companyId },
    include: { trips: true, fuelPurchases: true }
  });
  if (!quarter) {
    return NextResponse.json({ error: "Quarter not found" }, { status: 404 });
  }

  const worksheet = buildIftaWorksheet({
    trips: quarter.trips.map((t) => ({ jurisdiction: t.jurisdiction, miles: t.miles })),
    fuels: quarter.fuelPurchases.map((f) => ({
      jurisdiction: f.jurisdiction,
      gallons: f.gallons
    }))
  });

  const body = formatIftaWorksheetText({
    year: quarter.year,
    quarter: quarter.quarter,
    companyName: user.companyName,
    worksheet
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="ifta-Q${quarter.quarter}-${quarter.year}.txt"`
    }
  });
}
