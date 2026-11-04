import Image from "next/image";
import Link from "next/link";
import { formatRupees } from "@/lib/catalog/pricing";
import type { OrderView } from "@/lib/orders/schema";

export function describeOrder(
  o: Pick<OrderView, "status" | "paymentMethod" | "paymentStatus" | "totalPaise">,
) {
  if (o.status === "CANCELLED") {
    return {
      tone: "bad" as const,
      title: "This order was cancelled",
      detail: "If you paid, your money will be refunded.",
    };
  }
  if (o.status === "PENDING_PAYMENT") {
    return {
      tone: "warn" as const,
      title: "Waiting for your payment",
      detail: "Your order is saved but not confirmed until the payment is complete.",
    };
  }
  if (o.paymentMethod === "COD") {
    return {
      tone: "good" as const,
      title: "Order placed. Thank you!",
      detail: `Please keep ${formatRupees(o.totalPaise)} ready to pay in cash when your order arrives.`,
    };
  }
  return {
    tone: "good" as const,
    title: "Payment received. Thank you!",
    detail: "Your order is confirmed and will be prepared for dispatch.",
  };
}

const TONE = {
  good: "border-green-300 bg-green-50 text-green-900",
  warn: "border-amber-300 bg-amber-50 text-amber-900",
  bad: "border-red-300 bg-red-50 text-red-900",
} as const;

export function StatusBanner({ order }: { order: OrderView }) {
  const d = describeOrder(order);
  return (
    <div role="status" className={`rounded-sm border px-4 py-3 ${TONE[d.tone]}`}>
      <p className="font-semibold">{d.title}</p>
      <p className="text-sm">{d.detail}</p>
    </div>
  );
}

export function OrderDetails({ order }: { order: OrderView }) {
  const date = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <section aria-label="Items in this order">
        <ul className="divide-border divide-y">
          {order.items.map((i, idx) => (
            <li key={`${i.handle}-${idx}`} className="flex gap-4 py-4">
              <Link
                href={`/products/${i.handle}`}
                className="shrink-0"
                aria-hidden="true"
                tabIndex={-1}
              >
                <span className="bg-surface relative block h-24 w-20 overflow-hidden rounded-sm">
                  <Image
                    src={i.imageUrl}
                    alt=""
                    fill
                    sizes="80px"
                    unoptimized={i.imageUrl.endsWith(".svg")}
                    className="object-cover"
                  />
                </span>
              </Link>
              <div className="min-w-0 flex-1 text-sm">
                <Link
                  href={`/products/${i.handle}`}
                  className="line-clamp-2 font-medium hover:underline"
                >
                  {i.title}
                </Link>
                {i.variantTitle && <p className="text-muted">{i.variantTitle}</p>}
                <p className="text-muted mt-1">
                  {formatRupees(i.unitPricePaise)} × {i.quantity}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold">{formatRupees(i.lineTotalPaise)}</p>
            </li>
          ))}
        </ul>
      </section>

      <aside className="space-y-6 text-sm">
        <section aria-label="Order totals" className="border-border rounded-sm border p-4">
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatRupees(order.subtotalPaise)}</dd>
            </div>
            {order.discountPaise > 0 && (
              <div className="flex justify-between text-green-800">
                <dt>Prepaid discount</dt>
                <dd>&minus;{formatRupees(order.discountPaise)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Shipping</dt>
              <dd>{order.shippingPaise === 0 ? "Free" : formatRupees(order.shippingPaise)}</dd>
            </div>
            <div className="border-border flex justify-between border-t pt-3 text-base font-semibold">
              <dt>Total</dt>
              <dd data-testid="order-total">{formatRupees(order.totalPaise)}</dd>
            </div>
          </dl>
          <p className="text-muted mt-3">
            {order.paymentMethod === "COD" ? "Cash on delivery" : "Paid online"} · placed on {date}
          </p>
        </section>

        <section aria-label="Delivery address" className="border-border rounded-sm border p-4">
          <h2 className="mb-2 font-semibold">Delivering to</h2>
          <address className="text-muted not-italic">
            {order.address.fullName}
            <br />
            {order.address.line1}
            {order.address.line2 ? `, ${order.address.line2}` : ""}
            {order.address.landmark ? `, ${order.address.landmark}` : ""}
            <br />
            {order.address.city}, {order.address.state} {order.address.pincode}
            <br />
            Phone: {order.address.phone}
          </address>
          <p className="text-muted mt-3">Confirmation to {order.email}</p>
        </section>
      </aside>
    </div>
  );
}
