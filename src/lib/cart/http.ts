import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CART_COOKIE, CART_COOKIE_MAX_AGE } from "./constants";
import { generateCartToken, hashCartToken, isPlausibleToken } from "./token";
import { CartError, type CartErrorCode } from "./types";

const STATUS: Record<CartErrorCode, number> = {
  VARIANT_NOT_FOUND: 404,
  ITEM_NOT_FOUND: 404,
  SOLD_OUT: 409,
  CART_FULL: 409,
};

const noStore = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

/**
 * Mutations must come from this site: the Origin header, when present, has to match our host.
 * (Cookies are also SameSite=Lax, and bodies must be JSON, which browsers cannot send cross-site
 * without a CORS preflight.)
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (request.headers.get("host") ?? new URL(request.url).host);
  } catch {
    return false;
  }
}

export async function readTokenHash(): Promise<string | undefined> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  return isPlausibleToken(token) ? hashCartToken(token) : undefined;
}

/** Returns the hash for the current cart cookie, minting and setting a new cookie if needed. */
export async function tokenHashForWrite(): Promise<string> {
  const store = await cookies();
  const existing = store.get(CART_COOKIE)?.value;
  const token = isPlausibleToken(existing) ? existing : generateCartToken();
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  });
  return hashCartToken(token);
}

export function errorResponse(err: unknown) {
  if (err instanceof CartError)
    return json({ error: err.message, code: err.code }, STATUS[err.code]);
  if (err instanceof ZodError) return json({ error: "Invalid request", issues: err.issues }, 400);
  console.error("Cart API error", err);
  return json({ error: "Something went wrong. Please try again." }, 500);
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new ZodError([{ code: "custom", message: "Expected a JSON body", path: [] }]);
  }
  try {
    return await request.json();
  } catch {
    throw new ZodError([{ code: "custom", message: "Malformed JSON", path: [] }]);
  }
}
