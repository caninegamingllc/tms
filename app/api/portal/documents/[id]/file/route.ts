import { NextRequest, NextResponse } from "next/server";
import { CUSTOMER_FACING_DOCUMENT_TYPES } from "@/lib/customer-board";
import { readStoredFile } from "@/lib/document-storage";
import { prisma } from "@/lib/db";
import { getPortalViewer } from "@/lib/portal-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await getPortalViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const download = request.nextUrl.searchParams.get("download") === "1";

  const document = await prisma.loadDocument.findFirst({
    where: {
      id,
      companyId: viewer.companyId,
      OR: [
        { customerId: viewer.customerId },
        { load: { customerId: viewer.customerId } }
      ],
      type: { in: [...CUSTOMER_FACING_DOCUMENT_TYPES] }
    }
  });

  if (!document?.filePath) {
    return NextResponse.json({ error: "Document file not found." }, { status: 404 });
  }

  try {
    const fileBuffer = await readStoredFile(document.filePath);
    const mimeType = document.mimeType || "application/octet-stream";
    const fileName = document.originalFileName || document.name;
    const disposition = download
      ? `attachment; filename="${fileName.replace(/"/g, "")}"`
      : `inline; filename="${fileName.replace(/"/g, "")}"`;

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Document file is unavailable." }, { status: 404 });
  }
}
