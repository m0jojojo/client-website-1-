import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home placeholder", () => {
  it("renders the store name as the main heading", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "The Block Bagru" })).toBeInTheDocument();
  });
});
