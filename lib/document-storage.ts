import { randomBytes } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

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

function s3Configured() {
  return Boolean(
    process.env.S3_BUCKET?.trim() &&
      process.env.S3_ACCESS_KEY_ID?.trim() &&
      process.env.S3_SECRET_ACCESS_KEY?.trim()
  );
}

function getS3Client() {
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  const region = process.env.S3_REGION?.trim() || "auto";
  return new S3Client({
    region,
    endpoint,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!.trim()
    }
  });
}

function getBucket() {
  return process.env.S3_BUCKET!.trim();
}

function objectKey(storedPath: string) {
  const prefix = process.env.S3_PREFIX?.trim();
  const normalized = storedPath.replace(/^\/+/, "");
  return prefix ? path.posix.join(prefix, normalized) : normalized;
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

async function putObject(storedPath: string, body: Buffer, mimeType: string) {
  if (!s3Configured()) {
    const absolutePath = getAbsolutePath(storedPath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return;
  }

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: objectKey(storedPath),
      Body: body,
      ContentType: mimeType
    })
  );
}

export async function readStoredFile(storedPath: string): Promise<Buffer> {
  if (!s3Configured()) {
    return readFile(getAbsolutePath(storedPath));
  }

  const client = getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: objectKey(storedPath)
    })
  );

  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) {
    throw new Error("Object storage returned an empty body.");
  }
  return Buffer.from(bytes);
}

export async function saveUploadedFile(companyId: string, file: File) {
  const mimeType = validateUploadFile(file);
  const storedName = `${randomBytes(8).toString("hex")}-${sanitizeFileName(file.name)}`;
  const storedPath = path.posix.join(companyId, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await putObject(storedPath, buffer, mimeType);

  return {
    storedPath,
    mimeType,
    originalFileName: file.name,
    fileSizeBytes: file.size
  };
}

export async function saveBufferFile(
  companyId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
) {
  const storedName = `${randomBytes(8).toString("hex")}-${sanitizeFileName(fileName)}`;
  const storedPath = path.posix.join(companyId, storedName);
  await putObject(storedPath, buffer, mimeType);
  return {
    storedPath,
    mimeType,
    originalFileName: fileName,
    fileSizeBytes: buffer.length
  };
}

export async function deleteStoredFile(storedPath?: string | null) {
  if (!storedPath) {
    return;
  }

  if (!s3Configured()) {
    try {
      await unlink(getAbsolutePath(storedPath));
    } catch {
      // Ignore missing files during cleanup.
    }
    return;
  }

  try {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: getBucket(),
        Key: objectKey(storedPath)
      })
    );
  } catch {
    // Ignore missing objects during cleanup.
  }
}

export function isPreviewableMimeType(mimeType?: string | null) {
  return Boolean(mimeType && (mimeType === "application/pdf" || mimeType.startsWith("image/")));
}

export function isObjectStorageEnabled() {
  return s3Configured();
}
