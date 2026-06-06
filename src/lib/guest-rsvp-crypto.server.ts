import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

function key(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_URL || "lovable-fallback";
  return createHash("sha256").update(secret).digest();
}

export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function encryptEmail(email: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(email, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${enc.toString("hex")}:${tag.toString("hex")}`;
}

export function decryptEmail(blob: string): string {
  const [ivHex, encHex, tagHex] = blob.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]);
  return dec.toString("utf8");
}
