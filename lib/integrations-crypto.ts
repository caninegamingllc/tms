import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Shared AES-256-GCM helpers for IntegrationAccount tokens (ELD, etc.).
 * Prefers INTEGRATIONS_TOKEN_ENCRYPTION_KEY, then Intuit key for backward compatibility.
 */
function encryptionKey() {
  const secret =
    process.env.INTEGRATIONS_TOKEN_ENCRYPTION_KEY ||
    process.env.INTUIT_TOKEN_ENCRYPTION_KEY ||
    process.env.INTUIT_CLIENT_SECRET ||
    "";
  if (!secret) {
    throw new Error(
      "INTEGRATIONS_TOKEN_ENCRYPTION_KEY (or INTUIT_TOKEN_ENCRYPTION_KEY) is not configured."
    );
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string) {
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted token payload.");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}
