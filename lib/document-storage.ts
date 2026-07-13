import { randomBytes } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

export function getUploadDir() {
  return process.env.UPLOAD_DIR?.trim() || "./uploads";
}

export function getAbsolutePath(storedPath: string) {
  const uploadDir = path.resolve(getUploadDir());
  const absolutePath = path.resolve(uploadDir, storedPath);

  if (!absolutePath.startsWith(uploadDir)) {
    throw new Error("Invalid document path.");
  }

  return absolutePath;
}

function sanitizeFileName(fileName: string) {
  const baseName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]+/g, "-");
  return baseName || "document";
}

export function validateUploadFile(file: File) {
  if (!file || file.size <= 0) {
    throw new Error("A document file is required.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Document exceeds the 25 MB upload limit.");
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Only PDF, JPEG, PNG, and WebP files are supported.");
  }

  return mimeType;
}

export async function saveUploadedFile(companyId: string, file: File) {
  const mimeType = validateUploadFile(file);
  const uploadDir = path.resolve(getUploadDir());
  const companyDir = path.join(uploadDir, companyId);
  await mkdir(companyDir, { recursive: true });

  const storedName = `${randomBytes(8).toString("hex")}-${sanitizeFileName(file.name)}`;
  const storedPath = path.posix.join(companyId, storedName);
  const absolutePath = path.join(uploadDir, companyId, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return {
    storedPath,
    mimeType,
    originalFileName: file.name,
    fileSizeBytes: file.size
  };
}

export async function deleteStoredFile(storedPath?: string | null) {
  if (!storedPath) {
    return;
  }

  try {
    await unlink(getAbsolutePath(storedPath));
  } catch {
    // Ignore missing files during cleanup.
  }
}

export function isPreviewableMimeType(mimeType?: string | null) {
  return Boolean(mimeType && (mimeType === "application/pdf" || mimeType.startsWith("image/")));
}
