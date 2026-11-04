"use client";

import { useCallback, useRef, useState } from "react";
import type { PaymentLaunch } from "@/lib/orders/service";
import { formatRupees } from "@/lib/catalog/pricing";

export type PayResult =
  { status: "paid" } | { status: "dismissed" } | { status: "failed"; message: string };

type PayArgs = {
  launch: PaymentLaunch;
  orderNumber: number;
  token?: string;
  prefill: { name?: string; email?: string; phone?: string };
};

type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type RazorpayInstance = {
  open(): void;
  on(event: "payment.failed", cb: (r: { error?: { description?: string } }) => void): void;
};
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

let scriptPromise: Promise<RazorpayCtor> | null = null;

/** Loads Razorpay's checkout script once, straight from Razorpay. */
function loadRazorpay(): Promise<RazorpayCtor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  scriptPromise ??= new Promise<RazorpayCtor>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () =>
      window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Razorpay did not load"));
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load the payment window"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Asks our server to check Razorpay's signature and mark the order paid. */
async function confirmPayment(
  orderNumber: number,
  token: string | undefined,
  r: RazorpayResponse,
): Promise<PayResult> {
  try {
    const res = await fetch("/api/checkout/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber, token, ...r }),
    });
    if (res.ok) return { status: "paid" };
    const data = await res.json().catch(() => ({}));
    return { status: "failed", message: data.error ?? "We couldn't confirm your payment." };
  } catch {
    return {
      status: "failed",
      message:
        "We couldn't confirm your payment. If money was taken, your order will update shortly.",
    };
  }
}

type MockRequest = { args: PayArgs; resolve: (r: PayResult) => void };

/**
 * Starts a payment. With real Razorpay keys this opens Razorpay's own payment window. In local
 * test mode it shows a clearly labelled stand-in dialog instead. Either way the result is only
 * "paid" after our server has verified the signature.
 */
export function usePayment() {
  const [mock, setMock] = useState<MockRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(false);

  const pay = useCallback((args: PayArgs): Promise<PayResult> => {
    if (active.current) return Promise.resolve({ status: "dismissed" });
    active.current = true;
    const finish = (r: PayResult) => {
      active.current = false;
      return r;
    };

    if (args.launch.mode === "mock") {
      return new Promise<PayResult>((resolve) =>
        setMock({ args, resolve: (r) => resolve(finish(r)) }),
      );
    }

    return loadRazorpay()
      .then(
        (Razorpay) =>
          new Promise<PayResult>((resolve) => {
            let failure = "";
            const rzp = new Razorpay({
              key: args.launch.keyId,
              order_id: args.launch.providerOrderId,
              amount: args.launch.amountPaise,
              currency: "INR",
              name: "The Block Bagru",
              description: `Order BB${args.orderNumber}`,
              prefill: {
                name: args.prefill.name,
                email: args.prefill.email,
                contact: args.prefill.phone,
              },
              theme: { color: "#1d3463" },
              handler: (r: RazorpayResponse) => {
                void confirmPayment(args.orderNumber, args.token, r).then(resolve);
              },
              modal: {
                ondismiss: () =>
                  resolve(
                    failure ? { status: "failed", message: failure } : { status: "dismissed" },
                  ),
              },
            });
            rzp.on("payment.failed", (r) => {
              failure = r.error?.description ?? "The payment didn't go through.";
            });
            rzp.open();
          }),
      )
      .catch((): PayResult => ({
        status: "failed",
        message: "We couldn't open the payment window. Check your connection and try again.",
      }))
      .then(finish);
  }, []);

  const dialog = mock ? (
    <MockPaymentDialog
      amountPaise={mock.args.launch.amountPaise}
      busy={busy}
      onChoose={async (outcome) => {
        setBusy(true);
        try {
          const res = await fetch("/api/checkout/mock-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderNumber: mock.args.orderNumber,
              token: mock.args.token,
              outcome,
            }),
          });
          const data = await res.json().catch(() => ({}));
          const resolve = mock.resolve;
          setMock(null);
          if (!res.ok)
            return resolve({ status: "failed", message: data.error ?? "The test payment failed." });
          if (data.failed)
            return resolve({ status: "failed", message: data.reason ?? "Test payment declined" });
          resolve(await confirmPayment(mock.args.orderNumber, mock.args.token, data));
        } finally {
          setBusy(false);
        }
      }}
      onCancel={() => {
        mock.resolve({ status: "dismissed" });
        setMock(null);
      }}
    />
  ) : null;

  return { pay, dialog };
}

function MockPaymentDialog({
  amountPaise,
  busy,
  onChoose,
  onCancel,
}: {
  amountPaise: number;
  busy: boolean;
  onChoose: (o: "success" | "failure") => void;
  onCancel: () => void;
}) {
  const ref = useCallback((el: HTMLDialogElement | null) => {
    if (!el || el.open) return;
    if (typeof el.showModal === "function") el.showModal();
    else el.setAttribute("open", "");
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="mock-pay-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="bg-background m-auto w-[min(92vw,26rem)] rounded-sm p-6 shadow-xl backdrop:bg-black/60"
    >
      <p className="mb-2 inline-block rounded-sm bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
        TEST MODE: development only
      </p>
      <h2 id="mock-pay-title" className="text-lg font-semibold">
        Test payment
      </h2>
      <p className="text-muted mt-2 text-sm">
        This stands in for the Razorpay payment window while you build the site. No real money is
        charged.
      </p>
      <p className="mt-4 text-2xl font-semibold">{formatRupees(amountPaise)}</p>
      <div className="mt-6 grid gap-2">
        <button
          type="button"
          autoFocus
          disabled={busy}
          onClick={() => onChoose("success")}
          className="bg-accent text-accent-foreground h-11 rounded-sm px-4 font-medium disabled:opacity-50"
        >
          {busy ? "Processing..." : `Pay ${formatRupees(amountPaise)} (test)`}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onChoose("failure")}
          className="border-border h-11 rounded-sm border px-4 font-medium disabled:opacity-50"
        >
          Simulate a failed payment
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="h-10 text-sm underline underline-offset-4"
        >
          Cancel
        </button>
      </div>
    </dialog>
  );
}
