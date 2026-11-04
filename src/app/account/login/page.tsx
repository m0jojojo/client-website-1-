import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginCard } from "@/components/account/LoginCard";
import { isGoogleConfigured } from "@/lib/auth";
import { getSessionUser } from "@/lib/auth-session";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function LoginPage(props: PageProps<"/account/login">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16" aria-hidden="true" />}>
      <LoginContent {...props} />
    </Suspense>
  );
}

async function LoginContent({ searchParams }: PageProps<"/account/login">) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const next = safeNextPath(first(sp.next));
  if (await getSessionUser()) redirect(next);
  return <LoginCard next={next} configured={isGoogleConfigured()} error={first(sp.error)} />;
}
