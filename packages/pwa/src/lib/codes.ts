/**
 * 6-letter pairing codes. Uppercase A-Z minus ambiguous letters (I, O).
 */
import { randomBytes, createHash } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // 24 letters
const CODE_LENGTH = 6;

export function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

export function isValidCode(s: string): boolean {
  if (s.length !== CODE_LENGTH) return false;
  for (const ch of s) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}

/**
 * 256-bit key, base64url. Stored only on the client; we store a hash server-side.
 */
export function generateKey(): string {
  return randomBytes(32).toString("base64url");
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_ALPHABET = ALPHABET;
export const CODE_LEN = CODE_LENGTH;
