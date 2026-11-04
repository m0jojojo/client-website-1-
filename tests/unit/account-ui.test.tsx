import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AccountLink } from "@/components/account/AccountLink";
import { AccountNav } from "@/components/account/AccountNav";
import { AccountSync } from "@/components/account/AccountSync";
import { AddressManager } from "@/components/account/AddressManager";
import { LoginCard } from "@/components/account/LoginCard";
import type { AddressView } from "@/lib/account/address-schema";
import { wishlistStore } from "@/lib/wishlist-store";

const session = vi.hoisted(() => ({ value: { data: null as unknown, isPending: false } }));
const signInSocial = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn(async () => {}));
const pathname = vi.hoisted(() => ({ value: "/account" }));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => session.value,
    signIn: { social: signInSocial },
    signOut: vi.fn(),
  },
}));
vi.mock("@/components/cart/CartProvider", () => ({ useCart: () => ({ refresh }) }));
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const signedIn = (id = "u1", name = "Asha Verma") => ({
  data: { user: { id, name, email: "asha@example.com" } },
  isPending: false,
});

beforeEach(() => {
  session.value = { data: null, isPending: false };
  signInSocial.mockReset();
  refresh.mockClear();
  window.localStorage.clear();
  wishlistStore._reset();
});

describe("AccountLink", () => {
  it("links guests to the login page", () => {
    render(<AccountLink />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/account/login");
  });
  it("shows the customer's initial and links to the account when signed in", () => {
    session.value = signedIn();
    render(<AccountLink />);
    const link = screen.getByRole("link", { name: "Your account, Asha Verma" });
    expect(link).toHaveAttribute("href", "/account");
    expect(link).toHaveTextContent("A");
  });
});

describe("AccountNav", () => {
  it("marks the current section", () => {
    pathname.value = "/account/addresses";
    render(<AccountNav />);
    expect(screen.getByRole("link", { name: "Addresses" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Orders" })).not.toHaveAttribute("aria-current");
  });
});

describe("LoginCard", () => {
  it("starts Google sign-in with the return path and an error page", async () => {
    signInSocial.mockResolvedValue({ data: {}, error: null });
    render(<LoginCard next="/account/addresses" configured />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(signInSocial).toHaveBeenCalledTimes(1));
    expect(signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/account/addresses",
      errorCallbackURL: "/account/login",
    });
  });
  it("explains when Google is not configured and offers no button", () => {
    render(<LoginCard next="/account" configured={false} />);
    expect(screen.queryByRole("button", { name: /Google/ })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/isn.t set up/);
    expect(screen.getByRole("link", { name: /guest/ })).toHaveAttribute("href", "/collections/all");
  });
  it("shows a friendly message for known and unknown error codes", () => {
    const { rerender } = render(<LoginCard next="/account" configured error="access_denied" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/cancelled/);
    rerender(<LoginCard next="/account" configured error="weird_code" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/didn.t complete/);
  });
  it("recovers when starting sign-in fails", async () => {
    signInSocial.mockRejectedValue(new Error("network"));
    render(<LoginCard next="/account" configured />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn.t start/);
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  });
});

describe("AccountSync", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());
  const settle = () => act(async () => {});

  it("does nothing for guests", async () => {
    render(<AccountSync />);
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("waits while the session is loading", async () => {
    session.value = { data: null, isPending: true };
    render(<AccountSync />);
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("on sign-in sends the browser wishlist, adopts the merged list and refreshes the cart", async () => {
    wishlistStore.toggle("local-a");
    wishlistStore.toggle("local-b");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ wishlist: ["local-b", "local-a", "from-account"] }),
    });
    session.value = signedIn();
    render(<AccountSync />);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/account/sync");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ wishlist: ["local-b", "local-a"] });
    expect(wishlistStore.getSnapshot()).toEqual(["local-b", "local-a", "from-account"]);
    expect(refresh).toHaveBeenCalled();
  });

  it("syncs only once per sign-in, even across re-renders", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ wishlist: [] }) });
    session.value = signedIn();
    const { rerender } = render(<AccountSync />);
    await settle();
    rerender(<AccountSync />);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("mirrors later wishlist changes to the account while signed in", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ wishlist: [] }) });
    session.value = signedIn();
    render(<AccountSync />);
    await settle();
    fetchMock.mockClear();
    wishlistStore.toggle("new-item");
    wishlistStore.toggle("new-item");
    const calls = fetchMock.mock.calls.map(([u, i]) => `${i.method} ${u}`);
    expect(calls).toEqual([
      "PUT /api/account/wishlist/new-item",
      "DELETE /api/account/wishlist/new-item",
    ]);
  });

  it("clears the local wishlist and refreshes the cart on sign-out", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ wishlist: ["a"] }) });
    session.value = signedIn();
    const { rerender } = render(<AccountSync />);
    await settle();
    expect(wishlistStore.getSnapshot()).toEqual(["a"]);
    refresh.mockClear();
    session.value = { data: null, isPending: false };
    rerender(<AccountSync />);
    await settle();
    expect(wishlistStore.getSnapshot()).toEqual([]);
    expect(refresh).toHaveBeenCalled();
    fetchMock.mockClear();
    wishlistStore.toggle("x"); // no longer mirrored once signed out
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the local wishlist if the sync request fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    wishlistStore.toggle("keep-me");
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    session.value = signedIn();
    render(<AccountSync />);
    await settle();
    expect(wishlistStore.getSnapshot()).toEqual(["keep-me"]);
    spy.mockRestore();
  });
});

describe("wishlistStore remote hook", () => {
  it("replaceAll and clear do not call the remote", () => {
    const remote = { add: vi.fn(), remove: vi.fn() };
    wishlistStore.setRemote(remote);
    wishlistStore.replaceAll(["a", "b"]);
    wishlistStore.clear();
    expect(remote.add).not.toHaveBeenCalled();
    expect(remote.remove).not.toHaveBeenCalled();
    wishlistStore.toggle("c");
    wishlistStore.remove("c");
    expect(remote.add).toHaveBeenCalledWith("c");
    expect(remote.remove).toHaveBeenCalledWith("c");
  });
});

describe("AddressManager", () => {
  const addr = (over: Partial<AddressView> = {}): AddressView => ({
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
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());
  const reply = (status: number, body: unknown) => ({
    ok: status < 400,
    status,
    json: async () => body,
  });

  it("shows an empty state and lets the customer open the add form", () => {
    render(<AddressManager initial={[]} />);
    expect(screen.getByText("You have no saved addresses.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add a new address" }));
    expect(screen.getByRole("form", { name: "Save address" })).toBeInTheDocument();
    expect(screen.getByLabelText("Make this my default address")).toBeChecked();
  });

  it("lists addresses with a Default badge", () => {
    render(
      <AddressManager
        initial={[addr(), addr({ id: "a2", fullName: "Meera", isDefault: false })]}
      />,
    );
    const items = within(screen.getByRole("list", { name: "Saved addresses" })).getAllByRole(
      "listitem",
    );
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Default")).toBeInTheDocument();
    expect(within(items[1]).queryByText("Default")).not.toBeInTheDocument();
    expect(
      within(items[1]).getByRole("button", { name: "Make address for Meera the default" }),
    ).toBeInTheDocument();
  });

  it("shows server-side field errors next to the fields", async () => {
    fetchMock.mockResolvedValue(
      reply(400, {
        error: "Please check the highlighted fields.",
        fields: {
          phone: "Enter a valid 10-digit Indian mobile number",
          pincode: "Enter a valid 6-digit PIN code",
        },
      }),
    );
    render(<AddressManager initial={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a new address" }));
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    expect(
      await screen.findByText("Enter a valid 10-digit Indian mobile number"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Mobile number")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("PIN code")).toHaveAccessibleDescription(
      "Enter a valid 6-digit PIN code",
    );
  });

  it("adds an address and shows it in the list", async () => {
    fetchMock.mockResolvedValue(reply(201, { items: [addr()] }));
    render(<AddressManager initial={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a new address" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Asha Verma" } });
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: "Saved addresses" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Address saved.");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/account/addresses");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).fullName).toBe("Asha Verma");
  });

  it("changes the default address", async () => {
    fetchMock.mockResolvedValue(
      reply(200, {
        items: [addr({ id: "a2", fullName: "Meera", isDefault: true }), addr({ isDefault: false })],
      }),
    );
    render(
      <AddressManager
        initial={[addr(), addr({ id: "a2", fullName: "Meera", isDefault: false })]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Make address for Meera the default" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Default address changed."),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ isDefault: true });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/account/addresses/a2");
  });

  it("asks before deleting, and can be cancelled", async () => {
    render(<AddressManager initial={[addr()]} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete address for Asha Verma" }));
    expect(screen.getByText("Delete this address?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(screen.queryByText("Delete this address?")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes after confirmation", async () => {
    fetchMock.mockResolvedValue(reply(200, { items: [] }));
    render(<AddressManager initial={[addr()]} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete address for Asha Verma" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(await screen.findByText("You have no saved addresses.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("edits an address in place", async () => {
    fetchMock.mockResolvedValue(reply(200, { items: [addr({ city: "Udaipur" })] }));
    render(<AddressManager initial={[addr()]} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit address for Asha Verma" }));
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Udaipur" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByText(/Udaipur/)).toBeInTheDocument());
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
  });

  it("hides the add button at the 10 address limit", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      addr({ id: `a${i}`, isDefault: i === 0, fullName: `P${i}` }),
    );
    render(<AddressManager initial={many} />);
    expect(screen.queryByRole("button", { name: "Add a new address" })).not.toBeInTheDocument();
    expect(screen.getByText(/limit of 10/)).toBeInTheDocument();
  });
});
