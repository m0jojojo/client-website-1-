"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { AddressView } from "@/lib/account/address-schema";
import { INDIAN_STATES } from "@/lib/account/states";

type Fields = Record<string, string>;
const EMPTY = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  isDefault: false,
};

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false as const,
      error: (data.error as string) ?? "Something went wrong.",
      fields: (data.fields ?? {}) as Fields,
    };
  }
  return { ok: true as const, items: data.items as AddressView[] };
}

export function AddressManager({ initial }: { initial: AddressView[] }) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(fn: () => ReturnType<typeof call>, success: string) {
    setBusy(true);
    setMessage("");
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error);
      return false;
    }
    setItems(res.items);
    setMessage(success);
    return true;
  }

  return (
    <div className="mt-6">
      <p role="status" aria-live="polite" className="text-muted min-h-6 text-sm">
        {message}
      </p>

      {items.length === 0 && editing !== "new" && (
        <div className="py-12 text-center">
          <p className="text-lg font-medium">You have no saved addresses.</p>
          <p className="text-muted mt-1 text-sm">Add one to check out faster.</p>
        </div>
      )}

      <ul aria-label="Saved addresses" className="grid gap-4 sm:grid-cols-2">
        {items.map((a) => (
          <li key={a.id} className="border-border rounded-sm border p-4">
            {editing === a.id ? (
              <AddressForm
                initial={{ ...EMPTY, ...a, line2: a.line2 ?? "", landmark: a.landmark ?? "" }}
                submitLabel="Save changes"
                onCancel={() => setEditing(null)}
                onSubmit={async (values) => {
                  const res = await call(
                    `/api/account/addresses/${a.id}`,
                    "PATCH",
                    cleaned(values),
                  );
                  if (res.ok) {
                    setItems(res.items);
                    setEditing(null);
                    setMessage("Address updated.");
                  }
                  return res.ok ? null : res;
                }}
              />
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{a.fullName}</p>
                  {a.isDefault && (
                    <span className="bg-surface rounded-sm px-2 py-0.5 text-xs font-medium">
                      Default
                    </span>
                  )}
                </div>
                <address className="text-muted mt-1 text-sm not-italic">
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}
                  {a.landmark ? `, ${a.landmark}` : ""}
                  <br />
                  {a.city}, {a.state} {a.pincode}
                  <br />
                  Phone: {a.phone}
                </address>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <button
                    type="button"
                    className="underline underline-offset-4"
                    onClick={() => {
                      setEditing(a.id);
                      setConfirming(null);
                    }}
                    aria-label={`Edit address for ${a.fullName}`}
                  >
                    Edit
                  </button>
                  {!a.isDefault && (
                    <button
                      type="button"
                      disabled={busy}
                      className="underline underline-offset-4"
                      onClick={() =>
                        act(
                          () =>
                            call(`/api/account/addresses/${a.id}`, "PATCH", { isDefault: true }),
                          "Default address changed.",
                        )
                      }
                      aria-label={`Make address for ${a.fullName} the default`}
                    >
                      Make default
                    </button>
                  )}
                  {confirming === a.id ? (
                    <span
                      role="group"
                      aria-label="Confirm delete"
                      className="flex items-center gap-2"
                    >
                      <span>Delete this address?</span>
                      <button
                        type="button"
                        disabled={busy}
                        className="font-medium text-red-700 underline underline-offset-4"
                        onClick={async () => {
                          if (
                            await act(
                              () => call(`/api/account/addresses/${a.id}`, "DELETE"),
                              "Address deleted.",
                            )
                          ) {
                            setConfirming(null);
                          }
                        }}
                      >
                        Yes, delete
                      </button>
                      <button
                        type="button"
                        className="underline underline-offset-4"
                        onClick={() => setConfirming(null)}
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="underline underline-offset-4"
                      onClick={() => setConfirming(a.id)}
                      aria-label={`Delete address for ${a.fullName}`}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {editing === "new" ? (
          <div className="border-border max-w-xl rounded-sm border p-4">
            <h2 className="mb-3 text-lg font-semibold">Add a new address</h2>
            <AddressForm
              initial={{ ...EMPTY, isDefault: items.length === 0 }}
              submitLabel="Save address"
              onCancel={() => setEditing(null)}
              onSubmit={async (values) => {
                const res = await call("/api/account/addresses", "POST", cleaned(values));
                if (res.ok) {
                  setItems(res.items);
                  setEditing(null);
                  setMessage("Address saved.");
                }
                return res.ok ? null : res;
              }}
            />
          </div>
        ) : (
          items.length < 10 && (
            <Button variant="secondary" onClick={() => setEditing("new")}>
              Add a new address
            </Button>
          )
        )}
        {items.length >= 10 && (
          <p className="text-muted text-sm">You have reached the limit of 10 saved addresses.</p>
        )}
      </div>
    </div>
  );
}

function cleaned(v: typeof EMPTY) {
  return {
    fullName: v.fullName,
    phone: v.phone,
    line1: v.line1,
    line2: v.line2,
    landmark: v.landmark,
    city: v.city,
    state: v.state,
    pincode: v.pincode,
    isDefault: v.isDefault,
  };
}

function AddressForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: typeof EMPTY;
  submitLabel: string;
  onSubmit: (values: typeof EMPTY) => Promise<{ error: string; fields: Fields } | null>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Fields>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const uid = useId();

  const set =
    (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError("");
    const failure = await onSubmit(values);
    setBusy(false);
    if (failure) {
      setErrors(failure.fields);
      setFormError(Object.keys(failure.fields).length ? "" : failure.error);
    }
  }

  const field = (
    key: Exclude<keyof typeof EMPTY, "isDefault">,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => {
    const id = `${uid}-${key}`;
    const err = errors[key];
    return (
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-medium">
          {label}
        </label>
        <input
          id={id}
          name={key}
          value={values[key]}
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

  const stateId = `${uid}-state`;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4" aria-label={submitLabel}>
      {field("fullName", "Full name", { autoComplete: "name" })}
      {field("phone", "Mobile number", {
        inputMode: "tel",
        autoComplete: "tel",
        placeholder: "10-digit mobile number",
      })}
      {field("line1", "House no., building, street", { autoComplete: "address-line1" })}
      {field("line2", "Area, locality (optional)", { autoComplete: "address-line2" })}
      {field("landmark", "Landmark (optional)")}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("city", "City", { autoComplete: "address-level2" })}
        {field("pincode", "PIN code", {
          inputMode: "numeric",
          autoComplete: "postal-code",
          maxLength: 6,
        })}
      </div>
      <div>
        <label htmlFor={stateId} className="mb-1 block text-sm font-medium">
          State
        </label>
        <select
          id={stateId}
          name="state"
          value={values.state}
          onChange={set("state")}
          aria-invalid={errors.state ? true : undefined}
          aria-describedby={errors.state ? `${stateId}-error` : undefined}
          className="border-border bg-background h-11 w-full rounded-sm border px-3"
        >
          <option value="">Choose a state</option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {errors.state && (
          <p id={`${stateId}-error`} className="mt-1 text-sm text-red-700">
            {errors.state}
          </p>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.isDefault}
          onChange={(e) => setValues((v) => ({ ...v, isDefault: e.target.checked }))}
        />
        Make this my default address
      </label>

      {formError && (
        <p role="alert" className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800">
          {formError}
        </p>
      )}
      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving..." : submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
