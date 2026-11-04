import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { requireUserPage } from "@/lib/require-user";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-8" aria-hidden="true" />}>
      <Orders />
    </Suspense>
  );
}

async function Orders() {
  await requireUserPage("/account/orders");
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-wide uppercase">Your orders</h1>
      <div className="py-16 text-center">
        <p className="text-lg font-medium">You haven&apos;t placed any orders yet.</p>
        <p className="text-muted mt-1 text-sm">When you do, they will show up here.</p>
        <ButtonLink href="/collections/all" className="mt-6">
          Start shopping
        </ButtonLink>
      </div>
    </div>
  );
}
