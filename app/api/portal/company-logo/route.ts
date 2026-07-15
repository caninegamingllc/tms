import { NextResponse } from "next/server";
import { readStoredFile } from "@/lib/document-storage";
import { prisma } from "@/lib/db";
import { getPortalViewer } from "@/lib/portal-auth";

export async function GET() {
  const viewer = await getPortalViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const company = await prisma.company.findUnique({
    where: { id: viewer.companyId },
    select: { logoFilePath: true, logoMimeType: true }
  });

  if (!company?.logoFilePath || !company.logoMimeType) {
    return NextResponse.json({ error: "Logo not found." }, { status: 404 });
  }

  try {
    const buffer = await readStoredFile(company.logoFilePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": company.logoMimeType,
        "Cache-Control": "private, max-age=3600"
      }
    });
  } catch {
    return NextResponse.json({ error: "Logo unavailable." }, { status: 404 });
  }
}
