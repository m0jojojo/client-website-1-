"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function AccountLink() {
  const { data } = authClient.useSession();
  const user = data?.user;

  if (user) {
    const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();
    return (
      <Link
        href="/account"
        aria-label={`Your account, ${user.name || user.email}`}
        className="bg-accent text-accent-foreground flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
      >
        <span aria-hidden="true">{initial}</span>
      </Link>
    );
  }
  return (
    <Link href="/account/login" aria-label="Log in" className="hover:bg-surface rounded-sm p-2">
      <span aria-hidden="true">&#128100;</span>
    </Link>
  );
}
