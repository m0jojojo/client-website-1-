import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { PromoStrip } from "@/components/layout/PromoStrip";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { mainNav, siteConfig } from "@/lib/site";

describe("site config", () => {
  it("has 6 saree and 4 suit categories", () => {
    const sarees = mainNav.find((n) => n.label === "Sarees");
    const suits = mainNav.find((n) => n.label === "Suits");
    expect(sarees?.children).toHaveLength(6);
    expect(suits?.children).toHaveLength(4);
  });
  it("uses digits-only whatsapp number", () => {
    expect(siteConfig.whatsappNumber).toMatch(/^\d+$/);
  });
});

describe("PromoStrip", () => {
  it("shows the promo messages", () => {
    render(<PromoStrip />);
    expect(screen.getByRole("region", { name: "Store announcements" })).toHaveTextContent(
      /10% off on all prepaid orders/i,
    );
  });
});

describe("Header", () => {
  it("renders brand link and utility links", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: siteConfig.name })).toHaveAttribute("href", "/");
    for (const name of ["Search", "Log in", "Wishlist", "Cart"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("opens the Sarees dropdown on click and closes with Escape", async () => {
    render(<Header />);
    const main = screen.getByRole("navigation", { name: "Main" });
    const trigger = within(main).getByRole("button", { name: /Sarees/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const list = within(main).getByRole("list", { name: "Sarees categories" });
    expect(within(list).getAllByRole("link")).toHaveLength(6);
    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles the mobile menu", async () => {
    render(<Header />);
    expect(screen.queryByRole("navigation", { name: "Mobile" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("navigation", { name: "Mobile" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("navigation", { name: "Mobile" })).not.toBeInTheDocument();
  });
});

describe("Footer", () => {
  it("shows policies, contact details and GSTIN", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Return Policy" })).toHaveAttribute(
      "href",
      "/policies/returns",
    );
    expect(screen.getByRole("link", { name: siteConfig.email })).toHaveAttribute(
      "href",
      `mailto:${siteConfig.email}`,
    );
    expect(screen.getByText(new RegExp(siteConfig.gstin))).toBeInTheDocument();
  });
});

describe("WhatsAppButton", () => {
  it("links to wa.me and opens safely in a new tab", () => {
    render(<WhatsAppButton />);
    const link = screen.getByRole("link", { name: /whatsapp/i });
    expect(link).toHaveAttribute("href", `https://wa.me/${siteConfig.whatsappNumber}`);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });
});
