import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { authRateLimitConfig } from "@/lib/auth-rate-limit";
import { getDb } from "@/lib/db";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export function isGoogleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function createAuth() {
  return betterAuth({
    database: prismaAdapter(getDb(), { provider: "postgresql" }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    // Google is the only sign-in method. It is switched on only when both credentials exist.
    socialProviders: isGoogleConfigured()
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            prompt: "select_account",
          },
        }
      : {},
    session: { expiresIn: THIRTY_DAYS, updateAge: 60 * 60 * 24 },
    rateLimit: authRateLimitConfig(),
    plugins: [nextCookies()], // lets server components and actions set cookies
  });
}

type Auth = ReturnType<typeof createAuth>;
let instance: Auth | undefined;

/** Created on first use, so importing this file never needs a database (e.g. during the build). */
export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
