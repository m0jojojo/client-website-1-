import { createHash, randomBytes } from "node:crypto";

/** A new unguessable cart token for the browser cookie (256 bits). */
export function generateCartToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only the hash is stored, so a database leak does not expose usable cart tokens. */
export function hashCartToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isPlausibleToken(token: string | undefined): token is string {
  return !!token && /^[A-Za-z0-9_-]{43}$/.test(token);
}
