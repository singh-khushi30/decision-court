import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiveAnalysis } from "@/components/analysis/live-analysis";
import { AnalysisExperience } from "@/components/analysis/analysis-experience";
import { VerdictExperience } from "@/components/verdict/verdict-experience";
import { VerdictResult } from "@/components/verdict/verdict-result";
import { writeAnalysisResult } from "@/lib/analysis-result";
import { writeDecisionDraft } from "@/lib/decision-draft";
import { resetAnalysisRequestsForTests } from "@/lib/request-analysis";
import type { DecisionAnalysis } from "@/types/analysis";

const push = vi.fn();

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const analysis: DecisionAnalysis = {
  id: "live-1",
  decision: "Should I move cities for a year?",
  context: { situation: "Remote work.", goals: "", constraints: "", timeline: "" },
  advocateCase: {
    id: "advocate",
    eyebrow: "The Advocate",
    title: "The case for",
    activity: ["Built only from the context you supplied"],
    points: ["Proximity is the point of the move.", "Income may continue."],
  },
  challengerCase: {
    id: "challenger",
    eyebrow: "The Challenger",
    title: "The case against",
    activity: ["Stress-tested against the context you supplied"],
    points: ["A new lease is sticky.", "Return costs are unknown."],
  },
  dimensions: [
    { id: "relationships", label: "Relationship strain", score: 7, scale: 10, tone: "brass" },
    { id: "financial_impact", label: "Money", score: 5, scale: 10, tone: "brass" },
    { id: "risk", label: "Downside", score: 6, scale: 10, tone: "brass" },
    { id: "reversibility", label: "Ease of return", score: 4, scale: 10, tone: "brass" },
    { id: "evidence_quality", label: "Evidence in hand", score: 5, scale: 10, tone: "brass" },
  ],
  confidence: {
    value: 54,
    label: "Analysis confidence",
    note: "This reflects how complete and well-supported the analysis is based on the information supplied. It is not the probability that the decision will succeed.",
  },
  leaning: "Finely balanced",
  leaningSummary: "Proximity matters, and so does the cost of reversing the move.",
  bottomLine: "This reads as a close call until the cost of moving back is known.",
  forPoints: ["Proximity is the point of the move.", "Income may continue."],
  againstPoints: ["A new lease is sticky.", "Return costs are unknown."],
  keyInsights: [
    "The case for the move is about proximity.",
    "The expensive unknown is the return.",
  ],
  changeFactors: [
    {
      id: "return-cost",
      condition: "If returning were inexpensive",
      outcome: "The downside of trying the city gets smaller.",
      whyItMatters: "Reversibility is doing a lot of the work.",
    },
    {
      id: "remote",
      condition: "If remote work ended",
      outcome: "The financial case would weaken.",
      whyItMatters: "Income makes the experiment feel survivable.",
    },
  ],
  nextSteps: [
    "Price a return within six months.",
    "Confirm the remote arrangement in writing.",
    "Describe a bad month in the new city.",
  ],
  summary: "The supplied context supports a careful comparison, not a settled outcome.",
};

describe("live analysis and verdict result", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    resetAnalysisRequestsForTests();
    push.mockReset();
    vi.unstubAllGlobals();
  });

  it("shows a loading state and stores a successful analysis", async () => {
    writeDecisionDraft(
      {
        decision: "Should I move cities for a year?",
        situation: "Remote work.",
        goals: "",
        constraints: "",
        timeline: "",
      },
      3,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => analysis,
      }),
    );

    render(<LiveAnalysis />);

    expect(
      await screen.findByText(/advocate and challenger are examining the decision/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/not a live transcript/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/verdict/result");
    });
    expect(window.sessionStorage.getItem("decision-court.result")).toContain(
      "Finely balanced",
    );
  });

  it("shows the provider message when analysis fails", async () => {
    writeDecisionDraft(
      {
        decision: "Should I move cities for a year?",
        situation: "",
        goals: "",
        constraints: "",
        timeline: "",
      },
      3,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({
          error: "Decision Court couldn't complete the analysis right now. Please try again.",
        }),
      }),
    );

    render(<LiveAnalysis />);

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(/couldn't complete the analysis/i);
    expect(screen.getByRole("link", { name: /back to your decision/i })).toHaveAttribute(
      "href",
      "/decide",
    );
  });

  it("explains a missing decision without calling the API", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<LiveAnalysis />);

    expect(screen.getByRole("heading", { name: /add a decision first/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /describe a decision/i })).toHaveAttribute(
      "href",
      "/decide",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders a stored analysis and a missing-result state", () => {
    const { unmount } = render(<VerdictResult />);
    expect(
      screen.getByRole("heading", { name: /no analysis is saved/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start a decision/i })).toHaveAttribute(
      "href",
      "/decide",
    );
    unmount();

    writeAnalysisResult(analysis);
    render(<VerdictResult />);
    expect(screen.getByRole("heading", { name: "Finely balanced" })).toBeInTheDocument();
    expect(screen.getByText("Proximity is the point of the move.")).toBeInTheDocument();
    expect(screen.queryByText("Prepared demo")).not.toBeInTheDocument();
  });

  it("keeps the prepared demo routes independent", () => {
    render(<AnalysisExperience />);
    expect(screen.getByRole("link", { name: /view demo verdict/i })).toHaveAttribute(
      "href",
      "/verdict/demo",
    );

    render(<VerdictExperience />);
    expect(screen.getByText("Prepared demo")).toBeInTheDocument();
  });
});
