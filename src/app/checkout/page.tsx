import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { listAddresses } from "@/lib/account/addresses";
import { getSessionUser } from "@/lib/auth-session";
import { onlinePaymentAvailable } from "@/lib/payments/config";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8" aria-hidden="true" />}>
      <Checkout />
    </Suspense>
  );
}

async function Checkout() {
  const user = await getSessionUser();
  const savedAddresses = user ? await listAddresses(user.id) : [];
  return (
    <CheckoutForm
      user={user ? { name: user.name, email: user.email } : null}
      savedAddresses={savedAddresses}
      onlineAvailable={onlinePaymentAvailable()}
    />
  );
}
