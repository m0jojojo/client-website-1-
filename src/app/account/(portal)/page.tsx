import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/account/SignOutButton";
import { listAddresses } from "@/lib/account/addresses";
import { requireUserPage } from "@/lib/require-user";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-8" aria-hidden="true" />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const user = await requireUserPage("/account");
  const addresses = await listAddresses(user.id);
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="bg-accent text-accent-foreground flex h-14 w-14 items-center justify-center rounded-full text-xl font-semibold"
        >
          {initial}
        </span>
        <div>
          <h1 className="text-2xl font-semibold">Hello, {user.name || "there"}</h1>
          <p className="text-muted text-sm">{user.email}</p>
        </div>
      </div>

      <ul className="mt-8 grid gap-4 sm:grid-cols-3">
        <li className="border-border rounded-sm border p-4">
          <h2 className="font-semibold">Orders</h2>
          <p className="text-muted mt-1 text-sm">Track and review your purchases.</p>
          <Link
            href="/account/orders"
            className="mt-3 inline-block text-sm underline underline-offset-4"
          >
            View orders
          </Link>
        </li>
        <li className="border-border rounded-sm border p-4">
          <h2 className="font-semibold">Addresses</h2>
          <p className="text-muted mt-1 text-sm">
            {addresses.length === 0
              ? "No saved addresses yet."
              : `${addresses.length} saved ${addresses.length === 1 ? "address" : "addresses"}.`}
          </p>
          <Link
            href="/account/addresses"
            className="mt-3 inline-block text-sm underline underline-offset-4"
          >
            Manage addresses
          </Link>
        </li>
        <li className="border-border rounded-sm border p-4">
          <h2 className="font-semibold">Wishlist</h2>
          <p className="text-muted mt-1 text-sm">Saved on all your devices.</p>
          <Link href="/wishlist" className="mt-3 inline-block text-sm underline underline-offset-4">
            View wishlist
          </Link>
        </li>
      </ul>

      <div className="mt-8">
        <SignOutButton />
      </div>
    </div>
  );
}
