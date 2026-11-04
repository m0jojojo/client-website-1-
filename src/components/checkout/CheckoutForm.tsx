"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { AddressView } from "@/lib/account/address-schema";
import { INDIAN_STATES } from "@/lib/account/states";
import { formatRupees } from "@/lib/catalog/pricing";
import {
  computeTotals,
  PREPAID_DISCOUNT_PERCENT,
  type PaymentMethodKey,
} from "@/lib/orders/pricing";
import type { PaymentLaunch } from "@/lib/orders/service";
import { usePayment } from "./payment-client";

type Fields = Record<string, string>;

const blank = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
};

type Props = {
  user: { name: string; email: string } | null;
  savedAddresses: AddressView[];
  onlineAvailable: boolean;
};

export function CheckoutForm({ user, savedAddresses, onlineAvailable }: Props) {
  const router = useRouter();
  const uid = useId();
  const { cart, loading, refresh } = useCart();
  const { pay, dialog } = usePayment();

  const defaultSaved = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(defaultSaved?.phone ?? "");
  const [addressChoice, setAddressChoice] = useState<string>(defaultSaved?.id ?? "new");
  const [address, setAddress] = useState(blank);
  const [saveAddress, setSaveAddress] = useState(false);
  const [method, setMethod] = useState<PaymentMethodKey>(onlineAvailable ? "RAZORPAY" : "COD");
  const [errors, setErrors] = useState<Fields>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());

  const totals = computeTotals(cart.subtotalPaise, method);
  const usingSaved = addressChoice !== "new";

  const set =
    (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setAddress((a) => ({ ...a, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    setFormError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          paymentMethod: method,
          email,
          phone,
          ...(usingSaved
            ? { addressId: addressChoice }
            : {
                address: {
                  ...address,
                  line2: address.line2 || undefined,
                  landmark: address.landmark || undefined,
                },
                saveAddress: user ? saveAddress : undefined,
              }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        idempotencyKey.current = crypto.randomUUID(); // nothing was created: allow a fresh attempt
        if (data.fields) setErrors(data.fields);
        setFormError(
          data.fields
            ? "Please check the highlighted fields."
            : data.code === "ITEMS_UNAVAILABLE"
              ? `${data.error} (${(data.details as string[]).join(", ")})`
              : (data.error ?? "Something went wrong. Please try again."),
        );
        return;
      }

      const { order, token, payment } = data as {
        order: { orderNumber: number };
        token: string;
        payment: PaymentLaunch | null;
      };
      const orderUrl = `/orders/${order.orderNumber}?token=${encodeURIComponent(token)}`;

      if (!payment) {
        await refresh();
        router.push(orderUrl);
        return;
      }
      const result = await pay({
        launch: payment,
        orderNumber: order.orderNumber,
        token,
        prefill: { name: usingSaved ? defaultSaved?.fullName : address.fullName, email, phone },
      });
      if (result.status === "failed") {
        // The order exists and can still be paid from its own page.
        router.push(`${orderUrl}&retry=1`);
        return;
      }
      if (result.status === "paid") await refresh();
      router.push(orderUrl);
    } catch {
      idempotencyKey.current = crypto.randomUUID();
      setFormError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!loading && cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-wide uppercase">Checkout</h1>
        <p className="mt-6 text-lg font-medium">Your cart is empty.</p>
        <ButtonLink href="/collections/all" className="mt-6">
          Continue shopping
        </ButtonLink>
      </div>
    );
  }

  const input = (
    key: keyof typeof blank,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => {
    const id = `${uid}-addr-${key}`;
    const err = errors[key] ?? errors[`address.${key}`];
    return (
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-medium">
          {label}
        </label>
        <input
          id={id}
          name={key}
          value={address[key]}
          onChange={set(key)}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `${id}-error` : undefined}
          className="border-border h-11 w-full rounded-sm border px-3"
          {...props}
        />
        {err && (
          <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
            {err}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-wide uppercase">Checkout</h1>
      <form
        onSubmit={submit}
        noValidate
        aria-label="Checkout"
        className="mt-6 grid gap-8 lg:grid-cols-[1fr_24rem]"
      >
        <div className="space-y-8">
          {!user && (
            <p className="bg-surface rounded-sm px-3 py-2 text-sm">
              Have an account?{" "}
              <Link
                href="/account/login?next=/checkout"
                className="font-medium underline underline-offset-4"
              >
                Sign in
              </Link>{" "}
              for faster checkout, or continue as a guest.
            </p>
          )}

          <fieldset className="space-y-4">
            <legend className="mb-2 text-lg font-semibold">Contact</legend>
            <div>
              <label htmlFor={`${uid}-contact-email`} className="mb-1 block text-sm font-medium">
                Email
              </label>
              <input
                id={`${uid}-contact-email`}
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? `${uid}-contact-email-error` : undefined}
                className="border-border h-11 w-full rounded-sm border px-3"
              />
              {errors.email && (
                <p id={`${uid}-contact-email-error`} className="mt-1 text-sm text-red-700">
                  {errors.email}
                </p>
              )}
            </div>
            <div>
              <label htmlFor={`${uid}-contact-phone`} className="mb-1 block text-sm font-medium">
                Mobile number
              </label>
              <input
                id={`${uid}-contact-phone`}
                name="phone"
                inputMode="tel"
                autoComplete="tel"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={errors.phone ? true : undefined}
                aria-describedby={errors.phone ? `${uid}-contact-phone-error` : undefined}
                className="border-border h-11 w-full rounded-sm border px-3"
              />
              {errors.phone && (
                <p id={`${uid}-contact-phone-error`} className="mt-1 text-sm text-red-700">
                  {errors.phone}
                </p>
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-2 text-lg font-semibold">Delivery address</legend>
            {savedAddresses.length > 0 && (
              <div role="radiogroup" aria-label="Saved addresses" className="space-y-2">
                {savedAddresses.map((a) => (
                  <label
                    key={a.id}
                    className="border-border flex cursor-pointer items-start gap-3 rounded-sm border p-3 text-sm"
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={addressChoice === a.id}
                      onChange={() => setAddressChoice(a.id)}
                      className="mt-1"
                    />
                    <span>
                      <strong>{a.fullName}</strong>
                      {a.isDefault && (
                        <span className="bg-surface ml-2 rounded-sm px-1.5 py-0.5 text-xs">
                          Default
                        </span>
                      )}
                      <br />
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}
                    </span>
                  </label>
                ))}
                <label className="border-border flex cursor-pointer items-center gap-3 rounded-sm border p-3 text-sm">
                  <input
                    type="radio"
                    name="address"
                    checked={!usingSaved}
                    onChange={() => setAddressChoice("new")}
                  />
                  Use a different address
                </label>
              </div>
            )}
            {errors.address && <p className="text-sm text-red-700">{errors.address}</p>}
            {!usingSaved && (
              <div className="grid gap-4">
                {input("fullName", "Full name", { autoComplete: "name" })}
                {input("phone", "Mobile number for delivery", {
                  inputMode: "tel",
                  autoComplete: "tel",
                  placeholder: "10-digit mobile number",
                })}
                {input("line1", "House no., building, street", { autoComplete: "address-line1" })}
                {input("line2", "Area, locality (optional)", { autoComplete: "address-line2" })}
                {input("landmark", "Landmark (optional)")}
                <div className="grid gap-4 sm:grid-cols-2">
                  {input("city", "City", { autoComplete: "address-level2" })}
                  {input("pincode", "PIN code", {
                    inputMode: "numeric",
                    autoComplete: "postal-code",
                    maxLength: 6,
                  })}
                </div>
                <div>
                  <label htmlFor={`${uid}-addr-state`} className="mb-1 block text-sm font-medium">
                    State
                  </label>
                  <select
                    id={`${uid}-addr-state`}
                    name="state"
                    value={address.state}
                    onChange={set("state")}
                    aria-invalid={errors.state || errors["address.state"] ? true : undefined}
                    className="border-border bg-background h-11 w-full rounded-sm border px-3"
                  >
                    <option value="">Choose a state</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {(errors.state || errors["address.state"]) && (
                    <p className="mt-1 text-sm text-red-700">
                      {errors.state ?? errors["address.state"]}
                    </p>
                  )}
                </div>
                {user && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.checked)}
                    />
                    Save this address to my account
                  </label>
                )}
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-lg font-semibold">Payment</legend>
            <label
              className={`flex items-start gap-3 rounded-sm border p-4 text-sm ${
                onlineAvailable
                  ? "border-border cursor-pointer"
                  : "border-border cursor-not-allowed opacity-60"
              }`}
            >
              <input
                type="radio"
                name="payment"
                value="RAZORPAY"
                checked={method === "RAZORPAY"}
                disabled={!onlineAvailable}
                onChange={() => setMethod("RAZORPAY")}
                className="mt-1"
              />
              <span>
                <strong>Pay online</strong>{" "}
                <span className="bg-accent text-accent-foreground ml-1 rounded-sm px-1.5 py-0.5 text-xs font-semibold">
                  Save {PREPAID_DISCOUNT_PERCENT}%
                </span>
                <br />
                <span className="text-muted">
                  UPI, cards, netbanking and wallets, securely through Razorpay.
                </span>
                {!onlineAvailable && (
                  <span className="block text-red-700">
                    Online payment is not available right now.
                  </span>
                )}
              </span>
            </label>
            <label className="border-border flex cursor-pointer items-start gap-3 rounded-sm border p-4 text-sm">
              <input
                type="radio"
                name="payment"
                value="COD"
                checked={method === "COD"}
                onChange={() => setMethod("COD")}
                className="mt-1"
              />
              <span>
                <strong>Cash on delivery</strong>
                <br />
                <span className="text-muted">
                  Pay in cash when your order arrives. Available across India.
                </span>
              </span>
            </label>
          </fieldset>
        </div>

        <aside
          aria-label="Order summary"
          className="border-border h-fit rounded-sm border p-4 lg:sticky lg:top-24"
        >
          <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">Order summary</h2>
          {loading ? (
            <p role="status" className="text-muted text-sm">
              Loading your cart...
            </p>
          ) : (
            <>
              <ul aria-label="Items in your order" className="divide-border divide-y">
                {cart.lines.map((l) => (
                  <li key={l.id} className="flex justify-between gap-3 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="line-clamp-2 font-medium">{l.title}</span>
                      <span className="text-muted">Qty {l.quantity}</span>
                      {!l.available && (
                        <span className="block text-red-700">
                          Sold out. Remove it from your cart.
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-medium">
                      {l.available ? formatRupees(l.lineTotalPaise) : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="border-border mt-4 space-y-2 border-t pt-4 text-sm">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd>{formatRupees(totals.subtotalPaise)}</dd>
                </div>
                {totals.discountPaise > 0 && (
                  <div className="flex justify-between text-green-800">
                    <dt>Prepaid discount ({PREPAID_DISCOUNT_PERCENT}%)</dt>
                    <dd data-testid="discount">&minus;{formatRupees(totals.discountPaise)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt>Shipping</dt>
                  <dd>Free</dd>
                </div>
                <div className="border-border flex justify-between border-t pt-3 text-base font-semibold">
                  <dt>Total</dt>
                  <dd data-testid="total">{formatRupees(totals.totalPaise)}</dd>
                </div>
              </dl>
              <p className="text-muted mt-2 text-xs">Taxes included.</p>
            </>
          )}

          {formError && (
            <p role="alert" className="mt-4 rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}{" "}
              {formError.includes("sold out") && (
                <Link href="/cart" className="font-medium underline">
                  Go to cart
                </Link>
              )}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="mt-4 w-full"
            disabled={busy || loading || cart.itemCount === 0}
          >
            {busy
              ? "Please wait..."
              : method === "RAZORPAY"
                ? `Pay ${formatRupees(totals.totalPaise)}`
                : `Place order · ${formatRupees(totals.totalPaise)}`}
          </Button>
          <p className="text-muted mt-3 text-center text-xs">
            By placing your order you agree to our{" "}
            <Link href="/policies/terms" className="underline">
              terms
            </Link>
            .
          </p>
        </aside>
      </form>
      {dialog}
    </div>
  );
}
