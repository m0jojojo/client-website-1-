"use client";

import { useState } from "react";

/** On small screens the filters are hidden behind a button; on large screens they are always shown. */
export function FilterToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="listing-filters"
        onClick={() => setOpen((v) => !v)}
        className="border-border flex h-11 w-full items-center justify-between rounded-sm border px-4 text-sm font-medium lg:hidden"
      >
        Filter and sort
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <div id="listing-filters" className={`${open ? "mt-4 block" : "hidden"} lg:block`}>
        {children}
      </div>
    </div>
  );
}
