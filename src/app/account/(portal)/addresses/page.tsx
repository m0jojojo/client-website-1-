import type { Metadata } from "next";
import { Suspense } from "react";
import { AddressManager } from "@/components/account/AddressManager";
import { listAddresses } from "@/lib/account/addresses";
import { requireUserPage } from "@/lib/require-user";

export const metadata: Metadata = { title: "My addresses", robots: { index: false } };

export default function AddressesPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-8" aria-hidden="true" />}>
      <Addresses />
    </Suspense>
  );
}

async function Addresses() {
  const user = await requireUserPage("/account/addresses");
  const items = await listAddresses(user.id);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-wide uppercase">Your addresses</h1>
      <AddressManager initial={items} />
    </div>
  );
}
