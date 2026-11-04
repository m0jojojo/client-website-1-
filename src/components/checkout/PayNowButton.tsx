"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatRupees } from "@/lib/catalog/pricing";
import type { PaymentLaunch } from "@/lib/orders/service";
import { usePayment } from "./payment-client";

/** Lets a customer finish paying for an online order that is still waiting for payment. */
export function PayNowButton({
  launch,
  orderNumber,
  token,
  prefill,
}: {
  launch: PaymentLaunch;
  orderNumber: number;
  token?: string;
  prefill: { name?: string; email?: string; phone?: string };
}) {
  const router = useRouter();
  const { pay, dialog } = usePayment();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setMessage("");
    const result = await pay({ launch, orderNumber, token, prefill });
    setBusy(false);
    if (result.status === "paid") router.refresh();
    else if (result.status === "failed") setMessage(result.message);
  }

  return (
    <div>
      <Button size="lg" onClick={start} disabled={busy}>
        {busy ? "Please wait..." : `Pay ${formatRupees(launch.amountPaise)} now`}
      </Button>
      {message && (
        <p role="alert" className="mt-3 rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800">
          {message}
        </p>
      )}
      {dialog}
    </div>
  );
}
