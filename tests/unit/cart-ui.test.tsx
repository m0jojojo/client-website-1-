import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CartButton } from "@/components/cart/CartButton";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartPage } from "@/components/cart/CartPage";
import { CartProvider, useCart } from "@/components/cart/CartProvider";
import { AddToCartPanel } from "@/components/product/AddToCartPanel";
import { MAX_QUANTITY } from "@/lib/cart/constants";
import type { CartLine, CartView } from "@/lib/cart/types";

const line = (over: Partial<CartLine> = {}): CartLine => ({
  id: "i1",
  variantId: "v1",
  handle: "saree-1",
  title: "Tea Print Saree",
  variantTitle: null,
  pricePaise: 89900,
  compareAtPricePaise: 149900,
  quantity: 2,
  lineTotalPaise: 179800,
  available: true,
  imageUrl: "/images/placeholder.svg",
  imageAlt: "Tea Print Saree",
  ...over,
});

const cartOf = (lines: CartLine[]): CartView => {
  const live = lines.filter((l) => l.available);
  return {
    lines,
    itemCount: live.reduce((n, l) => n + l.quantity, 0),
    subtotalPaise: live.reduce((n, l) => n + l.lineTotalPaise, 0),
    savingsPaise: live.reduce(
      (n, l) => n + ((l.compareAtPricePaise ?? l.pricePaise) - l.pricePaise) * l.quantity,
      0,
    ),
  };
};

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number, error: string) => ({
  ok: false,
  status,
  json: async () => ({ error }),
});

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <CartProvider>
      <CartButton />
      <CartDrawer />
      {children}
    </CartProvider>
  );
}

const settle = () => act(async () => {});

describe("CartProvider and CartButton", () => {
  it("loads the cart on mount and shows the item count badge", async () => {
    fetchMock.mockResolvedValue(ok(cartOf([line({ quantity: 3, lineTotalPaise: 269700 })])));
    render(<Shell />);
    await settle();
    expect(fetchMock).toHaveBeenCalledWith("/api/cart", expect.anything());
    expect(screen.getByRole("button", { name: "Cart, 3 items" })).toBeInTheDocument();
  });

  it("shows no badge for an empty cart", async () => {
    fetchMock.mockResolvedValue(ok(cartOf([])));
    render(<Shell />);
    await settle();
    expect(screen.getByRole("button", { name: "Cart" })).toBeInTheDocument();
  });

  it("opens the drawer from the cart button", async () => {
    fetchMock.mockResolvedValue(ok(cartOf([line()])));
    render(<Shell />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: /^Cart/ }));
    const dialog = await screen.findByRole("dialog", { name: "Shopping cart" });
    expect(within(dialog).getByRole("heading", { name: "Your cart" })).toBeInTheDocument();
    expect(within(dialog).getByText("Tea Print Saree")).toBeInTheDocument();
  });

  it("useCart throws outside the provider", () => {
    const Bad = () => {
      useCart();
      return null;
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/CartProvider/);
    spy.mockRestore();
  });
});

describe("CartDrawer", () => {
  async function openWith(lines: CartLine[]) {
    fetchMock.mockResolvedValue(ok(cartOf(lines)));
    render(<Shell />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: /^Cart/ }));
    return screen.findByRole("dialog", { name: "Shopping cart" });
  }

  it("shows an empty state with a way to keep shopping", async () => {
    const dialog = await openWith([]);
    expect(within(dialog).getByText("Your cart is empty.")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Continue shopping" })).toHaveAttribute(
      "href",
      "/collections/all",
    );
  });

  it("shows lines, subtotal, savings and checkout links", async () => {
    const dialog = await openWith([line()]);
    expect(within(dialog).getByTestId("subtotal")).toHaveTextContent("₹1,798");
    expect(within(dialog).getByText("You save")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Checkout" })).toHaveAttribute(
      "href",
      "/checkout",
    );
    expect(within(dialog).getByRole("link", { name: "View cart" })).toHaveAttribute(
      "href",
      "/cart",
    );
  });

  it("changes quantity through the API and updates the totals", async () => {
    const dialog = await openWith([line()]);
    fetchMock.mockResolvedValueOnce(ok(cartOf([line({ quantity: 3, lineTotalPaise: 269700 })])));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Increase quantity of Tea Print Saree" }),
    );
    await waitFor(() => expect(within(dialog).getByTestId("subtotal")).toHaveTextContent("₹2,697"));
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe("/api/cart/items/i1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ quantity: 3 });
  });

  it("disables decrease at 1 and increase at the maximum", async () => {
    const dialog = await openWith([
      line({ id: "a", title: "A", quantity: 1, lineTotalPaise: 89900 }),
      line({ id: "b", title: "B", quantity: MAX_QUANTITY, lineTotalPaise: 899000 }),
    ]);
    expect(within(dialog).getByRole("button", { name: "Decrease quantity of A" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Increase quantity of B" })).toBeDisabled();
  });

  it("removes a line", async () => {
    const dialog = await openWith([line()]);
    fetchMock.mockResolvedValueOnce(ok(cartOf([])));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove Tea Print Saree from cart" }),
    );
    await waitFor(() =>
      expect(within(dialog).getByText("Your cart is empty.")).toBeInTheDocument(),
    );
    expect(fetchMock.mock.calls.at(-1)![1].method).toBe("DELETE");
  });

  it("flags sold-out lines and leaves them out of the total", async () => {
    const dialog = await openWith([
      line(),
      line({
        id: "i2",
        title: "Gone Saree",
        available: false,
        quantity: 1,
        lineTotalPaise: 100000,
      }),
    ]);
    expect(within(dialog).getByText(/Sold out. Not included/)).toBeInTheDocument();
    expect(within(dialog).getByTestId("subtotal")).toHaveTextContent("₹1,798");
    expect(
      within(dialog).queryByRole("button", { name: "Increase quantity of Gone Saree" }),
    ).not.toBeInTheDocument();
  });

  it("shows a server error message", async () => {
    const dialog = await openWith([line()]);
    fetchMock.mockResolvedValueOnce(fail(404, "That item is not in your cart."));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove Tea Print Saree from cart" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "That item is not in your cart.",
    );
  });

  it("closes with the close button", async () => {
    const dialog = await openWith([line()]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Close cart" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Cart/ })).toHaveAttribute(
        "aria-expanded",
        "false",
      ),
    );
  });
});

describe("AddToCartPanel", () => {
  const variants = [
    {
      id: "v1",
      title: "Default Title",
      sku: null,
      pricePaise: 89900,
      compareAtPricePaise: 149900,
      inStock: true,
    },
  ];

  it("posts the variant and quantity, then opens the drawer", async () => {
    fetchMock.mockResolvedValueOnce(ok(cartOf([])));
    render(
      <Shell>
        <AddToCartPanel title="Tea Print Saree" variants={variants} />
      </Shell>,
    );
    await settle();
    fetchMock.mockResolvedValueOnce(ok(cartOf([line({ quantity: 2, lineTotalPaise: 179800 })])));
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(await screen.findByRole("dialog", { name: "Shopping cart" })).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe("/api/cart/items");
    expect(JSON.parse(init.body)).toEqual({ variantId: "v1", quantity: 2 });
  });

  it("shows the server's message when adding fails", async () => {
    fetchMock.mockResolvedValueOnce(ok(cartOf([])));
    render(
      <Shell>
        <AddToCartPanel title="Tea Print Saree" variants={variants} />
      </Shell>,
    );
    await settle();
    fetchMock.mockResolvedValueOnce(fail(409, "Sorry, this item is sold out."));
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    await waitFor(() =>
      expect(screen.getByText("Sorry, this item is sold out.")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled();
  });
});

describe("CartPage", () => {
  it("shows loading, then the empty state", async () => {
    fetchMock.mockResolvedValue(ok(cartOf([])));
    render(
      <CartProvider>
        <CartPage />
      </CartProvider>,
    );
    expect(screen.getByText("Loading your cart...")).toBeInTheDocument();
    expect(await screen.findByText("Your cart is empty.")).toBeInTheDocument();
  });

  it("shows items with an order summary and checkout button", async () => {
    fetchMock.mockResolvedValue(ok(cartOf([line()])));
    render(
      <CartProvider>
        <CartPage />
      </CartProvider>,
    );
    const summary = await screen.findByRole("complementary", { name: "Order summary" });
    expect(within(summary).getByTestId("subtotal")).toHaveTextContent("₹1,798");
    expect(within(summary).getByRole("link", { name: "Checkout" })).toHaveAttribute(
      "href",
      "/checkout",
    );
    expect(screen.getByRole("list", { name: "Cart items" })).toBeInTheDocument();
  });

  it("shows an error when the cart cannot be loaded", async () => {
    fetchMock.mockResolvedValue(fail(500, "boom"));
    render(
      <CartProvider>
        <CartPage />
      </CartProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load your cart");
  });
});
