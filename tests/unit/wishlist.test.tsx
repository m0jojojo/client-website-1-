import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProductCard } from "@/components/catalog/ProductCard";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { WishlistLink } from "@/components/wishlist/WishlistLink";
import { WishlistPage } from "@/components/wishlist/WishlistPage";
import type { ProductSummary } from "@/lib/catalog/types";
import { MAX_WISHLIST, wishlistStore } from "@/lib/wishlist-store";

const KEY = "bagru:wishlist:v1";
const product = (n: number): ProductSummary => ({
  handle: `p-${n}`,
  title: `Product ${n}`,
  pricePaise: 89900,
  compareAtPricePaise: null,
  discountPercent: 0,
  inStock: true,
  imageUrl: "/images/placeholder.svg",
  imageAlt: `Product ${n}`,
});

beforeEach(() => {
  window.localStorage.clear();
  wishlistStore._reset();
});

describe("wishlist store", () => {
  it("toggles items, newest first, and persists to localStorage", () => {
    expect(wishlistStore.toggle("a")).toBe(true);
    expect(wishlistStore.toggle("b")).toBe(true);
    expect(wishlistStore.getSnapshot()).toEqual(["b", "a"]);
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual(["b", "a"]);
    expect(wishlistStore.toggle("a")).toBe(false);
    expect(wishlistStore.getSnapshot()).toEqual(["b"]);
  });

  it("reads saved data after a reload", () => {
    window.localStorage.setItem(KEY, JSON.stringify(["x", "y"]));
    expect(wishlistStore.getSnapshot()).toEqual(["x", "y"]);
    expect(wishlistStore.has("x")).toBe(true);
  });

  it("ignores corrupt or hostile stored data", () => {
    for (const bad of ["not json", '{"a":1}', '[1,2,{"x":1}]', "null"]) {
      window.localStorage.setItem(KEY, bad);
      wishlistStore._reset();
      expect(wishlistStore.getSnapshot()).toEqual([]);
    }
    window.localStorage.setItem(KEY, JSON.stringify(["ok", "ok", 5, "", "fine"]));
    wishlistStore._reset();
    expect(wishlistStore.getSnapshot()).toEqual(["ok", "fine"]);
  });

  it("caps the list length", () => {
    for (let i = 0; i < MAX_WISHLIST + 20; i++) wishlistStore.toggle(`p-${i}`);
    expect(wishlistStore.getSnapshot()).toHaveLength(MAX_WISHLIST);
    expect(wishlistStore.getSnapshot()[0]).toBe(`p-${MAX_WISHLIST + 19}`);
  });

  it("keeps working when storage throws", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(() => wishlistStore.toggle("a")).not.toThrow();
    expect(wishlistStore.getSnapshot()).toEqual(["a"]);
    spy.mockRestore();
  });

  it("notifies subscribers and reacts to changes from other tabs", () => {
    const listener = vi.fn();
    const off = wishlistStore.subscribe(listener);
    wishlistStore.toggle("a");
    expect(listener).toHaveBeenCalledTimes(1);
    window.localStorage.setItem(KEY, JSON.stringify(["from-other-tab"]));
    window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(wishlistStore.getSnapshot()).toEqual(["from-other-tab"]);
    off();
    wishlistStore.toggle("b");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("WishlistButton", () => {
  it("toggles, updates its label and aria-pressed", () => {
    render(<WishlistButton handle="p-1" title="Product 1" />);
    const btn = screen.getByRole("button", { name: "Add Product 1 to wishlist" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    const saved = screen.getByRole("button", { name: "Remove Product 1 from wishlist" });
    expect(saved).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(saved);
    expect(screen.getByRole("button", { name: "Add Product 1 to wishlist" })).toBeInTheDocument();
  });

  it("shows text labels on the product page variant", () => {
    render(<WishlistButton handle="p-1" title="Product 1" withLabel />);
    expect(screen.getByText("Add to wishlist")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Saved to wishlist")).toBeInTheDocument();
  });

  it("is on every product card and shares state with other buttons", () => {
    render(
      <>
        <ProductCard product={product(1)} />
        <WishlistButton handle="p-1" title="Product 1" withLabel />
      </>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Add Product 1 to wishlist" })[0]);
    expect(screen.getAllByRole("button", { name: "Remove Product 1 from wishlist" })).toHaveLength(
      2,
    );
  });
});

describe("WishlistLink", () => {
  it("shows a count badge once items are saved", () => {
    render(<WishlistLink />);
    expect(screen.getByRole("link", { name: "Wishlist" })).toHaveAttribute("href", "/wishlist");
    act(() => {
      wishlistStore.toggle("a");
      wishlistStore.toggle("b");
    });
    expect(screen.getByRole("link", { name: "Wishlist, 2 items" })).toBeInTheDocument();
  });
});

describe("WishlistPage", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows an empty state without calling the API", async () => {
    render(<WishlistPage />);
    expect(screen.getByText("Your wishlist is empty.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse all products" })).toHaveAttribute(
      "href",
      "/collections/all",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads saved products in saved order and drops removed ones", async () => {
    window.localStorage.setItem(KEY, JSON.stringify(["p-2", "p-1"]));
    wishlistStore._reset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [product(1), product(2)] }),
    });
    render(<WishlistPage />);
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/products?handles=p-2%2Cp-1&pageSize=60");
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(["Product 2", "Product 1"]);
    expect(screen.getByText("2 items saved")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Product 2 from wishlist" }));
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(1));
  });

  it("shows an error message when loading fails", async () => {
    window.localStorage.setItem(KEY, JSON.stringify(["p-1"]));
    wishlistStore._reset();
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<WishlistPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load your wishlist");
  });
});
