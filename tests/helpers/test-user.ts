import { neon } from "@neondatabase/serverless";
import { createHmac, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "better-auth.session_token";

/** Same format Better Auth uses: "<token>.<base64 HMAC-SHA256>", URL-encoded. */
export function signCookieValue(value: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(value).digest("base64");
  return encodeURIComponent(`${value}.${signature}`);
}

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export type TestUser = {
  userId: string;
  name: string;
  email: string;
  token: string;
  /** Ready for `context.addCookies([...])` */
  cookie: { name: string; value: string; url: string };
};

/**
 * Creates a user and a live session directly in the database and returns a signed session cookie,
 * so tests can act as a signed-in customer without going through Google.
 * Uses plain SQL because Playwright cannot load the generated Prisma client.
 */
export async function createTestUser(
  opts: { name?: string; baseUrl?: string } = {},
): Promise<TestUser> {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  const key = randomBytes(6).toString("hex");
  const userId = `test_user_${key}`;
  const email = `${userId}@e2e.test`;
  const name = opts.name ?? `Test Customer ${key}`;
  const token = randomBytes(24).toString("base64url");
  const db = sql();
  await db.query(
    'INSERT INTO "User" ("id","name","email","emailVerified","updatedAt") VALUES ($1,$2,$3,true,NOW())',
    [userId, name, email],
  );
  await db.query(
    'INSERT INTO "Session" ("id","expiresAt","token","updatedAt","userId") VALUES ($1, NOW() + INTERVAL \'1 day\', $2, NOW(), $3)',
    [`test_session_${key}`, token, userId],
  );
  return {
    userId,
    name,
    email,
    token,
    cookie: {
      name: SESSION_COOKIE,
      value: signCookieValue(token, secret),
      url: opts.baseUrl ?? "http://localhost:3000",
    },
  };
}

/** Deletes the test users (their sessions, carts, addresses and wishlist rows cascade). */
export async function deleteTestUsers(userIds: string[]) {
  if (userIds.length === 0) return;
  await sql().query('DELETE FROM "User" WHERE "id" = ANY($1) AND "email" LIKE $2', [
    userIds,
    "%@e2e.test",
  ]);
}

/** Safety net for crashed runs: removes any leftover test users and anonymous carts older than an hour. */
export async function deleteStaleTestData() {
  const db = sql();
  await db.query(
    'DELETE FROM "User" WHERE "email" LIKE $1 AND "createdAt" < NOW() - INTERVAL \'1 hour\'',
    ["%@e2e.test"],
  );
}
