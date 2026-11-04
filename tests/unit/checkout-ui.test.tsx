import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { PayNowButton } from "@/components/checkout/PayNowButton";
import { StatusBanner, describeOrder, OrderDetails } from "@/components/orders/OrderDetails";
import type { AddressView } from "@/lib/account/address-schema";
import type { CartLine, CartView } from "@/lib/cart/types";
import type { OrderView } from "@/lib/orders/schema";

const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn(async () => {}));
const cartState = vi.hoisted(() => ({ cart: null as unknown, loading: false }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/components/cart/CartProvider", () => ({
  useCart: () => ({ cart: cartState.cart, loading: cartState.loading, refresh }),
}));

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
const cartOf = (lines: CartLine[]): CartView => ({
  lines,
  itemCount: lines.filter((l) => l.available).reduce((n, l) => n + l.quantity, 0),
  subtotalPaise: lines.filter((l) => l.available).reduce((n, l) => n + l.lineTotalPaise, 0),
  savingsPaise: 0,
});

const saved = (over: Partial<AddressView> = {}): AddressView => ({
  id: "a1",
  fullName: "Asha Verma",
  phone: "9876543210",
  line1: "12 Mansarovar Colony",
  line2: null,
  landmark: null,
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302020",
  isDefault: true,
  ...over,
});

const order = (over: Partial<OrderView> = {}): OrderView => ({
  orderNumber: 1001,
  label: "BB1001",
  status: "CONFIRMED",
  paymentMethod: "COD",
  paymentStatus: "PENDING",
  email: "asha@example.com",
  phone: "9876543210",
  createdAt: "2026-11-04T10:00:00.000Z",
  paidAt: null,
  failureReason: null,
  subtotalPaise: 179800,
  discountPaise: 0,
  shippingPaise: 0,
  totalPaise: 179800,
  address: {
    fullName: "Asha Verma",
    phone: "9876543210",
    line1: "12 Mansarovar Colony",
    line2: null,
    landmark: null,
    city: "Jaipur",
    state: "Rajasthan",
    pincode: "302020",
  },
  items: [
    {
      handle: "saree-1",
      title: "Tea Print Saree",
      variantTitle: null,
      imageUrl: "/images/placeholder.svg",
      unitPricePaise: 89900,
      compareAtPricePaise: 149900,
      quantity: 2,
      lineTotalPaise: 179800,
    },
  ],
  ...over,
});

const fetchMock = vi.fn();
const reply = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

beforeEach(() => {
  cartState.cart = cartOf([line()]);
  cartState.loading = false;
  push.mockClear();
  refresh.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const fillGuest = () => {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "asha@example.com" } });
  fireEvent.change(
    screen.getByLabelText("Mobile number", {
      selector: "#" + screen.getByLabelText("Email").id.replace("email", "phone"),
    }),
    { target: { value: "9876543210" } },
  );
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Asha Verma" } });
  fireEvent.change(screen.getByLabelText("House no., building, street"), {
    target: { value: "12 Mansarovar Colony" },
  });
  fireEvent.change(screen.getByLabelText("City"), { target: { value: "Jaipur" } });
  fireEvent.change(screen.getByLabelText("PIN code"), { target: { value: "302020" } });
  fireEvent.change(screen.getByLabelText("State"), { target: { value: "Rajasthan" } });
};
const sentBody = (i = 0) => JSON.parse(fetchMock.mock.calls[i][1].body);

describe("CheckoutForm summary and payment choice", () => {
  it("shows the items and a 10% prepaid discount when paying online", () => {
    render(<CheckoutForm user={null} savedAddresses={[]} onlineAvailable />);
    expect(screen.getByRole("radio", { name: /Pay online/ })).toBeChecked();
    const summary = screen.getByRole("complementary", { name: "Order summary" });
    expect(within(summary).getByText("Tea Print Saree")).toBeInTheDocument();
    expect(within(summary).getByTestId("discount")).toHaveTextContent("₹179.80"); // 10% of ₹1,798
    expect(within(summary).getByTestId("total")).toHaveTextContent("₹1,618.20");
    expect(within(summary).getByText("Free")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay ₹1,618.20" })).toBeInTheDocument();
  });

  it("removes the discount and charges full price for cash on delivery", () => {
    render(<CheckoutForm user={null} savedAddresses={[]} onlineAvailable />);
    fireEvent.click(screen.getByRole("radio", { name: /Cash on delivery/ }));
    expect(screen.queryByTestId("discount")).not.toBeInTheDocument();
    expect(screen.getByTestId("total")).toHaveTextContent("₹1,798");
    expect(screen.getByRole("button", { name: "Place order · ₹1,798" })).toBeInTheDocument();
  });

  it("disables online payment and defaults to COD when it is not available", () => {
    render(<CheckoutForm user={null} savedAddresses={[]} onlineAvailable={false} />);
    expect(screen.getByRole("radio", { name: /Pay online/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Cash on delivery/ })).toBeChecked();
    expect(screen.getByText(/not available right now/)).toBeInTheDocument();
  });

  it("shows an empty-cart page instead of the form", () => {
    cartState.cart = cartOf([]);
    render(<CheckoutForm user={null} savedAddresses={[]} onlineAvailable />);
    expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Checkout" })).not.toBeInTheDocument();
  });

  it("flags sold-out items and leaves them out of the total", () => {
    cartState.cart = cartOf([
      line(),
      line({
        id: "i2",
        title: "Gone Saree",
        available: false,
        lineTotalPaise: 100000,
        quantity: 1,
      }),
    ]);
    render(<CheckoutForm user={null} savedAddresses={[]} onlineAvailable />);
    expect(screen.getByText(/Sold out. Remove it/)).toBeInTheDocument();
    expect(screen.getByTestId("total")).toHaveTextContent("₹1,618.20");
  });

  it("suggests signing in for guests, and skips that for signed-in customers", () => {
    const { unmount } = render(<CheckoutForm user={null} savedAddresses={[]} onlineAvailable />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/account/login?next=/checkout",
    );
    unmount();
    render(
      <CheckoutForm
        user={{ name: "Asha", email: "asha@example.com" }}
        savedAddresses={[]}
        onlineAvailable
      />,
    );
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("asha@example.com");
  });
});

describe("CheckoutForm placing orders", () => {
  it("places a cash on delivery order and goes to its page with the private token", async () => {
    fetchMock.mockResolvedValueOnce(
      reply(200, { order: { orderNumber: 1001 }, token: "tok/en+1", payment: null }),
    );
    render(<CheckoutForm user={null} savedAddresses={[]} onlineAvailable />);
    fireEvent.click(screen.getByRole("radio", { name: /Cash on delivery/ }));
    fillGuest();
    fireEvent.click(screen.getByRole("button", { name: /Place order/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/orders/1001?token=tok%2Fen%2B1"));
    expect(refresh).toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/checkout");
  });

  it("sends who, where and how, and never a price or total", async () => {
    fetchMock.mockResolvedValueOnce(
      reply(200, { order: { orderNumber: 1001 }, token: "t", payment: null }),
    );
    render(<CheckoutForm user={null} savedAddresses={[]} onlineAvailable />);
    fireEvent.click(screen.getByRole("radio", { name: /Cash on delivery/ }));
    fillGuest();
    fireEvent.click(screen.getByRole("button", { name: /Place order/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = sentBody();
    expect(Object.keys(body).sort()).toEqual(
      ["address", "email", "idempotencyKey", "paymentMethod", "phone"].sort(),
    );
    expect(body.paymentMethod).toBe("COD");
    expect(body.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.address.line2).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/paise|total|price|amount/i);
  });

  it("uses the chosen saved address by id and preselects the default one", async () => {
    fetchMock.mockResolvedValueOnce(
      reply(200, { order: { orderNumber: 1002 }, token: "t", payment: null }),
    );
    const addresses = [saved({ id: "a-other", fullName: "Meera", isDefault: false }), saved()];
    render(
      <CheckoutForm
        user={{ name: "Asha", email: "a@x.com" }}
        savedAddresses={addresses}
        onlineAvailable
      />,
    );
    expect(screen.getByRole("radio", { name: /Asha Verma/ })).toBeChecked();
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Cash on delivery/ }));
    fireEvent.click(screen.getByRole("button", { name: /Place order/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = sentBody();
    expect(body.addressId).toBe("a1");
    expect(body.address).toBeUndefined();
  });

  it("lets a signed-in customer type a new address and offers to save it", async () => {
    fetchMock.mockResolvedValueOnce(
      reply(200, { order: { orderNumber: 1003 }, token: "t", payment: null }),
    );
    render(
      <CheckoutForm
        user={{ name: "Asha", email: "a@x.com" }}
        savedAddresses={[saved()]}
        onlineAvailable
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Use a different address" }));
    fillGuest();
    fireEvent.click(screen.getByLabelText("Save this address to my account"));
    fireEvent.click(screen.getByRole("radio", { name: /Cash on delivery/ }));
    fireEvent.click(screen.getByRole("button", { name: /Place order/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody()).toMatchObject({ saveAddress: true, address: { city: "Jaipur" } });
    expect(sentBody().addressId).toBeUndefined();
  });

  it("shows field errors from the server next to the fields and allows a fresh attempt", async () => {
    fetchMock.mockResolvedValue(
      reply(400, {
        error: "Please check the highlighted fields.",
        fields: {
          email: "Enter a valid email address",
          phone: "Enter a valid 10-digit Indian mobile number",
        },
      }),
    );
    render(<CheckoutForm user={null} savedAddresses={[]} onlineAvailable />);
    fireEvent.click(screen.getByRole("radio", { name: /Cash on delivery/ }));
    fireEvent.click(screen.getByRole("button", { name: /Place order/ }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("highlighted fields");
    expect(push).not.toHaveBeenCalled();
    // a fresh attempt uses a fresh idempotency key (the failed one created nothing)
    fireEvent.click(screen.getByRole("button", { name: /Place order/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(sentBody(1).idempotencyKey).not.toBe(sentBody(0).idempotencyKey);
  });

  it("explains which items are sold out and links to the cart", async () => {
    fetchMock.mockResolvedValueOnce(
      reply(409, {
        error: "Some items in your cart are sold out. Please remove them to continue.",
        code: "ITEMS_UNAVAILABLE",
        details: ["Gone Saree"],
      }),
    );
    render(<CheckoutForm user={null} savedAddresses={[]} onlineAvailable />);
    fireEvent.click(screen.getByRole("radio", { name: /Cash on delivery/ }));
    fireEvent.click(screen.getByRole("button", { name: /Place order/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Gone Saree");
    expect(within(alert).getByRole("link", { name: "Go to cart" })).toHaveAttribute(
      "href",
      "/cart",
    );
  });

  it("does not submit twice while an order is being placed", async () => {
    let resolve!: (v: unknown) => void;
    fetchMock.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    render(<CheckoutForm user={null} savedAddresses={[]} onlineAvailable />);
    fireEvent.click(screen.getByRole("radio", { name: /Cash on delivery/ }));
    const button = screen.getByRole("button", { name: /Place order/ });
    fireEvent.click(button);
    expect(await screen.findByRole("button", { name: "Please wait..." })).toBeDisabled();
    fireEvent.submit(screen.getByRole("form", { name: "Checkout" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(reply(200, { order: { orderNumber: 1 }, token: "t", payment: null }));
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it("recovers from a network failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    render(<CheckoutForm user={null} savedAddresses={[]} onlineAvailable />);
    fireEvent.click(screen.getByRole("radio", { name: /Cash on delivery/ }));
    fireEvent.click(screen.getByRole("button", { name: /Place order/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't reach the server/);
    expect(screen.getByRole("button", { name: /Place order/ })).toBeEnabled();
  });
});

describe("CheckoutForm online payment (test dialog)", () => {
  const launch = {
    mode: "mock",
    keyId: "rzp_test_mock",
    providerOrderId: "order_mock_1",
    amountPaise: 161820,
  };
  const placed = { order: { orderNumber: 1004 }, token: "tk", payment: launch };

  it("opens a clearly marked test dialog, then verifies the payment before showing the order", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(200, placed))
      .mockResolvedValueOnce(
        reply(200, {
          razorpay_order_id: "order_mock_1",
          razorpay_payment_id: "pay_mock_1",
          razorpay_signature: "sig",
        }),
      )
      .mockResolvedValueOnce(reply(200, { order: { orderNumber: 1004 } }));
    render(<CheckoutForm user={null} savedAddresses={[]} onlineAvailable />);
    fillGuest();
    fireEvent.click(screen.getByRole("button", { name: "Pay ₹1,618.20" }));
    const dialog = await screen.findByRole("dialog", { name: "Test payment" });
    expect(within(dialog).getByText(/TEST MODE/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Pay ₹1,618.20 (test)" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/orders/1004?token=tk"));
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toEqual(["/api/checkout", "/api/checkout/mock-payment", "/api/checkout/verify"]);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({
      orderNumber: 1004,
      token: "tk",
      razorpay_order_id: "order_mock_1",
      razorpay_payment_id: "pay_mock_1",
      razorpay_signature: "sig",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("sends the customer to the order page to retry if the payment fails", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(200, placed))
      .mockResolvedValueOnce(reply(200, { failed: true, reason: "Test payment declined" }));
    render(<CheckoutForm user={null} savedAddresses={[]} onlineAvailable />);
    fillGuest();
    fireEvent.click(screen.getByRole("button", { name: "Pay ₹1,618.20" }));
    const dialog = await screen.findByRole("dialog", { name: "Test payment" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simulate a failed payment" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/orders/1004?token=tk&retry=1"));
  });

  it("keeps the order for later if the customer cancels the dialog", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, placed));
    render(<CheckoutForm user={null} savedAddresses={[]} onlineAvailable />);
    fillGuest();
    fireEvent.click(screen.getByRole("button", { name: "Pay ₹1,618.20" }));
    const dialog = await screen.findByRole("dialog", { name: "Test payment" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/orders/1004?token=tk"));
    expect(fetchMock).toHaveBeenCalledTimes(1); // no payment or verification call
  });

  it("does not treat a rejected verification as paid", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(200, placed))
      .mockResolvedValueOnce(
        reply(200, {
          razorpay_order_id: "order_mock_1",
          razorpay_payment_id: "pay_mock_1",
          razorpay_signature: "bad",
        }),
      )
      .mockResolvedValueOnce(reply(400, { error: "We couldn't confirm that payment." }));
    render(<CheckoutForm user={null} savedAddresses={[]} onlineAvailable />);
    fillGuest();
    fireEvent.click(screen.getByRole("button", { name: "Pay ₹1,618.20" }));
    const dialog = await screen.findByRole("dialog", { name: "Test payment" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Pay ₹1,618.20 (test)" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/orders/1004?token=tk&retry=1"));
    expect(refresh).not.toHaveBeenCalled(); // cart is not cleared when payment was not confirmed
  });
});

describe("PayNowButton with the real Razorpay window", () => {
  type Opts = {
    key: string;
    order_id: string;
    amount: number;
    currency: string;
    name: string;
    prefill: Record<string, string>;
    handler: (r: Record<string, string>) => void;
    modal: { ondismiss: () => void };
  };
  let opts: Opts | null;
  let failHandler: ((r: { error?: { description?: string } }) => void) | null;
  const live = {
    mode: "live" as const,
    keyId: "rzp_test_abc",
    providerOrderId: "order_live_1",
    amountPaise: 161820,
  };

  beforeEach(() => {
    opts = null;
    failHandler = null;
    (window as unknown as { Razorpay: unknown }).Razorpay = class {
      constructor(o: Opts) {
        opts = o;
      }
      open() {}
      on(_e: string, cb: typeof failHandler) {
        failHandler = cb;
      }
    };
  });
  afterEach(() => {
    delete (window as unknown as { Razorpay?: unknown }).Razorpay;
  });

  const start = async () => {
    render(
      <PayNowButton
        launch={live}
        orderNumber={1005}
        token="tk"
        prefill={{ name: "Asha", email: "a@x.com", phone: "9876543210" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pay ₹1,618.20 now" }));
    await waitFor(() => expect(opts).not.toBeNull());
  };

  it("opens Razorpay with the order, amount and the customer's details", async () => {
    await start();
    expect(opts).toMatchObject({
      key: "rzp_test_abc",
      order_id: "order_live_1",
      amount: 161820,
      currency: "INR",
      name: "The Block Bagru",
      prefill: { name: "Asha", email: "a@x.com", contact: "9876543210" },
    });
  });

  it("asks our server to verify the signature after Razorpay reports success", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { order: {} }));
    await start();
    act(() =>
      opts!.handler({
        razorpay_order_id: "order_live_1",
        razorpay_payment_id: "pay_1",
        razorpay_signature: "sig",
      }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/checkout/verify");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      orderNumber: 1005,
      token: "tk",
      razorpay_signature: "sig",
    });
  });

  it("shows Razorpay's failure reason when the customer closes the window after a failed attempt", async () => {
    await start();
    act(() => failHandler!({ error: { description: "Your card was declined" } }));
    act(() => opts!.modal.ondismiss());
    expect(await screen.findByRole("alert")).toHaveTextContent("Your card was declined");
    expect(screen.getByRole("button", { name: "Pay ₹1,618.20 now" })).toBeEnabled();
  });

  it("stays quiet when the customer just closes the window", async () => {
    await start();
    act(() => opts!.modal.ondismiss());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Pay ₹1,618.20 now" })).toBeEnabled(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("order page pieces", () => {
  it("describes every state in plain words", () => {
    expect(describeOrder(order()).title).toBe("Order placed. Thank you!");
    expect(describeOrder(order()).detail).toContain("₹1,798");
    expect(describeOrder(order({ paymentMethod: "RAZORPAY", paymentStatus: "PAID" })).title).toBe(
      "Payment received. Thank you!",
    );
    expect(
      describeOrder(order({ status: "PENDING_PAYMENT", paymentMethod: "RAZORPAY" })).title,
    ).toBe("Waiting for your payment");
    expect(describeOrder(order({ status: "CANCELLED" })).title).toBe("This order was cancelled");
  });
  it("shows totals, discount, delivery address and items", () => {
    render(
      <>
        <StatusBanner
          order={order({
            paymentMethod: "RAZORPAY",
            paymentStatus: "PAID",
            discountPaise: 17980,
            totalPaise: 161820,
          })}
        />
        <OrderDetails
          order={order({
            paymentMethod: "RAZORPAY",
            paymentStatus: "PAID",
            discountPaise: 17980,
            totalPaise: 161820,
          })}
        />
      </>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Payment received");
    expect(screen.getByTestId("order-total")).toHaveTextContent("₹1,618.20");
    expect(screen.getByText("Prepaid discount")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    const address = screen.getByRole("region", { name: "Delivery address" });
    expect(address).toHaveTextContent("12 Mansarovar Colony");
    expect(address).toHaveTextContent("Jaipur, Rajasthan 302020");
    expect(
      within(screen.getByRole("region", { name: "Items in this order" })).getAllByRole("listitem"),
    ).toHaveLength(1);
  });
});
