import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PayNowButton } from "@/components/checkout/PayNowButton";
import { OrderDetails, StatusBanner } from "@/components/orders/OrderDetails";
import { getSessionUser } from "@/lib/auth-session";
import { getPaymentsConfig } from "@/lib/payments/config";
import { parseOrderLabel } from "@/lib/orders/pricing";
import { getAccessibleOrder, paymentLaunchFor } from "@/lib/orders/service";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
  referrer: "no-referrer", // the page address can contain a private link token
};

export default function OrderPage(props: PageProps<"/orders/[number]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-8" aria-hidden="true" />}>
      <Order {...props} />
    </Suspense>
  );
}

async function Order({ params, searchParams }: PageProps<"/orders/[number]">) {
  const { number } = await params;
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const orderNumber = parseOrderLabel(number);
  if (orderNumber === null) notFound();

  const token = first(sp.token);
  const found = await getAccessibleOrder({ orderNumber, user: await getSessionUser(), token });
  if (!found) notFound(); // looks the same whether it does not exist or belongs to someone else
  const { order, row } = found;
  const launch = paymentLaunchFor(row, getPaymentsConfig());

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-wide uppercase">Order {order.label}</h1>
      <div className="mt-4">
        <StatusBanner order={order} />
        {order.status === "PENDING_PAYMENT" && order.failureReason && (
          <p role="alert" className="mt-3 rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800">
            Your last payment attempt didn&apos;t go through: {order.failureReason}. You can try
            again.
          </p>
        )}
        {launch && (
          <div className="mt-4">
            <PayNowButton
              launch={launch}
              orderNumber={order.orderNumber}
              token={token}
              prefill={{ name: order.address.fullName, email: order.email, phone: order.phone }}
            />
          </div>
        )}
      </div>
      <div className="mt-8">
        <OrderDetails order={order} />
      </div>
    </div>
  );
}
