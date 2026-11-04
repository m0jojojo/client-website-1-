import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-muted text-sm font-semibold tracking-widest uppercase">404</p>
      <h1 className="mt-2 text-3xl font-semibold">Page not found</h1>
      <p className="text-muted mt-3">
        This page could not be found. It may have moved, or the link may be wrong.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/collections/all">Browse all products</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Go to the home page
        </ButtonLink>
      </div>
      <p className="mt-6 text-sm">
        Looking for something specific?{" "}
        <Link href="/search" className="underline underline-offset-4">
          Search the shop
        </Link>
      </p>
    </main>
  );
}
