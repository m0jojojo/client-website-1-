"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";

const ERRORS: Record<string, string> = {
  access_denied: "Sign-in was cancelled. You can try again whenever you like.",
  account_not_linked: "That email is already linked to a different sign-in method.",
  unable_to_get_user_info: "We couldn't read your Google profile. Please try again.",
};

export function LoginCard({
  next,
  configured,
  error,
}: {
  next: string;
  configured: boolean;
  error?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await authClient.signIn.social({
        provider: "google",
        callbackURL: next,
        errorCallbackURL: "/account/login",
      });
      if (res?.error) throw new Error(res.error.message);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  const message = failed
    ? "We couldn't start Google sign-in. Please try again."
    : error
      ? (ERRORS[error] ?? "Sign-in didn't complete. Please try again.")
      : "";

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-2xl font-semibold tracking-wide uppercase">Sign in</h1>
      <p className="text-muted mt-2 text-center text-sm">
        Sign in to save your addresses, keep your cart and wishlist on every device, and see your
        orders.
      </p>

      {message && (
        <p role="alert" className="mt-6 rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800">
          {message}
        </p>
      )}

      <div className="mt-8">
        {configured ? (
          <Button size="lg" className="w-full" onClick={signIn} disabled={busy}>
            {busy ? "Opening Google..." : "Continue with Google"}
          </Button>
        ) : (
          <p role="status" className="border-border bg-surface rounded-sm border px-3 py-3 text-sm">
            Google sign-in isn&apos;t set up on this site yet. You can still browse and check out as
            a guest.
          </p>
        )}
      </div>

      <p className="text-muted mt-6 text-center text-xs">
        We only receive your name and email address from Google. We never see your Google password.
      </p>
      <p className="mt-6 text-center text-sm">
        <Link href="/collections/all" className="underline underline-offset-4">
          Continue shopping as a guest
        </Link>
      </p>
    </div>
  );
}
