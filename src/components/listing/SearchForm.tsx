import { Button } from "@/components/ui/Button";

export function SearchForm({ defaultValue }: { defaultValue: string }) {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      aria-label="Search products"
      className="flex gap-2"
    >
      <label className="flex-1">
        <span className="sr-only">Search products</span>
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder="Search sarees, suits..."
          minLength={1}
          maxLength={100}
          required
          className="border-border h-11 w-full rounded-sm border px-3"
        />
      </label>
      <Button type="submit">Search</Button>
    </form>
  );
}
