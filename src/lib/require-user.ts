import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth-session";

/** For account pages: returns the customer, or sends the visitor to sign in and back again. */
export async function requireUserPage(returnTo: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/account/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}
