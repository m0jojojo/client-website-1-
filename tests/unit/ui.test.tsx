import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

describe("Button", () => {
  it("renders a button that defaults to type=button and fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add to cart</Button>);
    const btn = screen.getByRole("button", { name: "Add to cart" });
    expect(btn).toHaveAttribute("type", "button");
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies variant classes and respects disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button variant="secondary" disabled onClick={onClick}>
        Nope
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Nope" });
    expect(btn.className).toContain("border-foreground");
    expect(btn).toBeDisabled();
  });

  it("ButtonLink renders an anchor with the href", () => {
    render(<ButtonLink href="/collections/new-arrivals">Shop</ButtonLink>);
    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute(
      "href",
      "/collections/new-arrivals",
    );
  });
});

describe("Card", () => {
  it("renders children and merges className", () => {
    render(
      <Card className="p-4" data-testid="card">
        hello
      </Card>,
    );
    expect(screen.getByTestId("card")).toHaveTextContent("hello");
    expect(screen.getByTestId("card").className).toContain("p-4");
  });
});
