/**
 * Upload existing local UPLOAD_DIR files into S3-compatible object storage.
 *
 * Usage (with S3_* env set):
 *   npx tsx scripts/migrate-uploads-to-s3.ts
 */
import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

async function walk(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full, base)));
    } else if (entry.isFile()) {
      files.push(path.relative(base, full).split(path.sep).join("/"));
    }
  }
  return files;
}

async function main() {
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required.");
  }

  const uploadDir = path.resolve(process.env.UPLOAD_DIR?.trim() || "./uploads");
  const prefix = process.env.S3_PREFIX?.trim() || "";
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  const region = process.env.S3_REGION?.trim() || "auto";

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: Boolean(endpoint),
    credentials: { accessKeyId, secretAccessKey }
  });

  const files = await walk(uploadDir);
  console.log(`Uploading ${files.length} files from ${uploadDir}`);

  for (const relative of files) {
    const body = await readFile(path.join(uploadDir, relative));
    const key = prefix ? `${prefix.replace(/\/$/, "")}/${relative}` : relative;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body
      })
    );
    console.log("uploaded", key, (await stat(path.join(uploadDir, relative))).size);
  }

  // Touch no-op so unused import stays if Delete is needed later.
  void DeleteObjectCommand;
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
