"use client";

import { PRODUCT_SORTS, type ProductSort } from "@/lib/catalog/types";
import { SORT_LABELS } from "@/lib/catalog/sort-labels";

/** Sort dropdown that submits its parent form as soon as the value changes. */
export function SortSelect({ value }: { value: ProductSort }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium">Sort by:</span>
      <select
        name="sort"
        defaultValue={value}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="border-border bg-background h-10 rounded-sm border px-2"
      >
        {PRODUCT_SORTS.map((s) => (
          <option key={s} value={s}>
            {SORT_LABELS[s]}
          </option>
        ))}
      </select>
    </label>
  );
}
