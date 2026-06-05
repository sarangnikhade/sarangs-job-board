import "server-only";
import crypto from "node:crypto";

/**
 * AES-256-GCM wrap for at-rest secrets (OpenRouter API key).
 * Key derived from APP_SECRET env var via scrypt. APP_SECRET must
 * stay constant across restarts or stored ciphertext becomes unreadable.
 */
const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const SALT = Buffer.from("sarangs-job-board-v1"); // static — APP_SECRET is the real entropy

function key() {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "APP_SECRET env var required (>=16 chars) for credential storage",
    );
  }
  return crypto.scryptSync(secret, SALT, 32);
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Pack iv|tag|ct as one base64 blob.
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const ct = buf.subarray(IV_LEN + 16);
  const decipher = crypto.createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/** Mask for display — shows first 4 / last 4 of the key. */
export function maskKey(plain: string): string {
  if (!plain) return "";
  if (plain.length <= 12) return "•".repeat(plain.length);
  return `${plain.slice(0, 4)}${"•".repeat(8)}${plain.slice(-4)}`;
}
