import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisExperience } from "@/components/analysis/analysis-experience";
import { DecisionFlow } from "@/components/decision/decision-flow";
import { LandingPage } from "@/components/landing/landing-page";
import { VerdictExperience } from "@/components/verdict/verdict-experience";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("landing", () => {
  it("links the primary calls to action into the decision flow", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("link", { name: /start a decision/i }),
    ).toHaveAttribute("href", "/decide");
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute(
      "href",
      "/decide",
    );
  });
});

describe("decision form", () => {
  it("requires a decision before leaving the first step", async () => {
    render(<DecisionFlow />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /describe the decision/i,
    );
    expect(
      screen.queryByRole("heading", { name: /add more context/i }),
    ).not.toBeInTheDocument();
  });

  it("walks from the decision through context to the demo analysis", async () => {
    render(<DecisionFlow />);

    fireEvent.change(screen.getByRole("textbox", { name: "Decision" }), {
      target: { value: "Should I move cities for a year?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(
      await screen.findByRole("heading", { name: /add more context/i }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /current situation/i }),
    );
    expect(
      screen.getByRole("textbox", { name: /current situation/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(
      await screen.findByRole("heading", { name: /review your decision/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Should I move cities for a year?")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /analyze with ai agents/i }),
    ).toHaveAttribute("href", "/analysis/demo");
  });
});

describe("demo analysis and verdict", () => {
  it("offers a direct path from the analysis preview to the verdict", () => {
    render(<AnalysisExperience />);

    expect(
      screen.getByRole("link", { name: /view demo verdict/i }),
    ).toHaveAttribute("href", "/verdict/demo");
  });

  it("expands a scenario with why it would move the verdict", () => {
    render(<VerdictExperience />);

    const scenario = screen.getByRole("button", { name: /if salary were lower/i });
    expect(scenario).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(scenario);

    expect(scenario).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Why this matters" })).toBeVisible();
    expect(screen.getByText(/pay is doing a lot of the work/i)).toBeInTheDocument();
  });
});
