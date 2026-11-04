import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { formatRupees } from "@/lib/catalog/pricing";
import { listOrdersForUser } from "@/lib/orders/service";
import { requireUserPage } from "@/lib/require-user";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-8" aria-hidden="true" />}>
      <Orders />
    </Suspense>
  );
}

const STATUS_LABEL = {
  PENDING_PAYMENT: "Waiting for payment",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
} as const;

async function Orders() {
  const user = await requireUserPage("/account/orders");
  const orders = await listOrdersForUser(user.id);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-wide uppercase">Your orders</h1>
      {orders.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-lg font-medium">You haven&apos;t placed any orders yet.</p>
          <p className="text-muted mt-1 text-sm">When you do, they will show up here.</p>
          <ButtonLink href="/collections/all" className="mt-6">
            Start shopping
          </ButtonLink>
        </div>
      ) : (
        <ul
          aria-label="Your orders"
          className="divide-border border-border mt-6 divide-y rounded-sm border"
        >
          {orders.map((o) => (
            <li
              key={o.orderNumber}
              className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"
            >
              <div>
                <p className="font-semibold">Order {o.label}</p>
                <p className="text-muted">
                  {new Date(o.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {" · "}
                  {o.items.reduce((n, i) => n + i.quantity, 0)}{" "}
                  {o.items.reduce((n, i) => n + i.quantity, 0) === 1 ? "item" : "items"}
                </p>
              </div>
              <p>{STATUS_LABEL[o.status]}</p>
              <p className="font-semibold">{formatRupees(o.totalPaise)}</p>
              <Link
                href={`/orders/${o.orderNumber}`}
                className="underline underline-offset-4"
                aria-label={`View order ${o.label}`}
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
