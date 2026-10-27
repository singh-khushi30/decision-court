import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function SmokeStatus() {
  return <p>Decision Court test environment is ready.</p>;
}

describe("test environment", () => {
  it("renders with React Testing Library in jsdom", () => {
    render(<SmokeStatus />);

    expect(
      screen.getByText("Decision Court test environment is ready."),
    ).toBeInTheDocument();
  });
});
