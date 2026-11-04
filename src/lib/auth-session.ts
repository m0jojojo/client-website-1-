import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

export type SessionUser = { id: string; name: string; email: string; image?: string | null };

/** The signed-in customer for this request, or null. Server-side only. */
export async function getSessionUser(): Promise<SessionUser | null> {
  // Read the request headers outside the try block: Next.js signals "this page is dynamic" by
  // making this call reject during the build, and that signal must not be swallowed.
  const requestHeaders = await headers();
  try {
    const session = await getAuth().api.getSession({ headers: requestHeaders });
    const u = session?.user;
    return u ? { id: u.id, name: u.name, email: u.email, image: u.image } : null;
  } catch (err) {
    // A 401 just means "no valid session" (e.g. the session was deleted): treat as signed out.
    const status = (err as { statusCode?: number } | null)?.statusCode;
    if (status !== 401) console.error("Session lookup failed", err);
    return null;
  }
}
