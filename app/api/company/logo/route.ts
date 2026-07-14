import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { requireTmsAccess } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getAbsolutePath } from "@/lib/document-storage";

export async function GET() {
  const user = await requireTmsAccess();
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: user.companyId },
    select: {
      logoFilePath: true,
      logoMimeType: true,
      logoOriginalFileName: true
    }
  });

  if (!company.logoFilePath || !company.logoMimeType) {
    return new NextResponse("Logo not found", { status: 404 });
  }

  const buffer = await readFile(getAbsolutePath(company.logoFilePath));
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": company.logoMimeType,
      "Content-Disposition": `inline; filename="${company.logoOriginalFileName ?? "logo"}"`,
      "Cache-Control": "private, max-age=300"
    }
  });
}
