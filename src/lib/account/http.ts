import { ZodError } from "zod";
import { getSessionUser, type SessionUser } from "@/lib/auth-session";
import { errorResponse as cartErrorResponse, isSameOrigin, json } from "@/lib/cart/http";
import { AccountError } from "./errors";

export { isSameOrigin, json };
export { readJson } from "@/lib/cart/http";

/** Returns the signed-in customer, or a ready-made 401 response. */
export async function requireUser(): Promise<SessionUser | Response> {
  const user = await getSessionUser();
  if (!user) return json({ error: "Please sign in to continue.", code: "UNAUTHENTICATED" }, 401);
  return user;
}

const STATUS = { NOT_FOUND: 404, LIMIT_REACHED: 409 } as const;

/** Turns zod issues into { field: message } so forms can show errors next to inputs. */
export function fieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function errorResponse(err: unknown) {
  if (err instanceof AccountError)
    return json({ error: err.message, code: err.code }, STATUS[err.code]);
  if (err instanceof ZodError) {
    return json({ error: "Please check the highlighted fields.", fields: fieldErrors(err) }, 400);
  }
  return cartErrorResponse(err);
}
