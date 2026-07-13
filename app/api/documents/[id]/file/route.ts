import { readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { getAbsolutePath } from "@/lib/document-storage";
import { prisma } from "@/lib/db";
import { requireTmsAccess } from "@/lib/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireTmsAccess();
  const { id } = await params;
  const download = request.nextUrl.searchParams.get("download") === "1";

  const document = await prisma.loadDocument.findUnique({
    where: { id, companyId: user.companyId }
  });

  if (!document?.filePath) {
    return NextResponse.json({ error: "Document file not found." }, { status: 404 });
  }

  try {
    const absolutePath = getAbsolutePath(document.filePath);
    const fileBuffer = await readFile(absolutePath);
    const mimeType = document.mimeType || "application/octet-stream";
    const fileName = document.originalFileName || document.name;
    const disposition = download
      ? `attachment; filename="${fileName.replace(/"/g, "")}"`
      : `inline; filename="${fileName.replace(/"/g, "")}"`;

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=3600"
      }
    });
  } catch {
    return NextResponse.json({ error: "Document file is unavailable." }, { status: 404 });
  }
}
