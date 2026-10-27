import type { DecisionAnalysis } from "@/types/analysis";

export const analysisStages = [
  { id: "understand", label: "Understanding your situation" },
  { id: "cases", label: "Building the cases" },
  { id: "cross", label: "Cross-examination" },
  { id: "evidence", label: "Evaluating evidence" },
  { id: "verdict", label: "Generating verdict" },
] as const;

export const demoAnalysis: DecisionAnalysis = {
  id: "startup-offer",
  decision: "Should I leave my stable job for an early-stage startup?",
  context: {
    situation:
      "You have a stable role, predictable pay, and benefits. An early-stage startup has asked you to join.",
    goals: "Grow faster, do more meaningful work, and improve compensation.",
    constraints: "Income stability, benefits, and the time the new role would take.",
    timeline: "A decision is needed soon enough that waiting out the uncertainty is itself a choice.",
  },
  advocateCase: {
    id: "advocate",
    eyebrow: "The Advocate",
    title: "Building the strongest case for",
    activity: [
      "Identifying key benefits",
      "Finding supporting evidence",
      "Building the strongest argument",
    ],
    points: [
      "Significant career growth potential",
      "Higher compensation",
      "More impactful problems",
      "Valuable startup skills",
    ],
  },
  challengerCase: {
    id: "challenger",
    eyebrow: "The Challenger",
    title: "Building the strongest case against",
    activity: [
      "Identifying potential risks",
      "Exploring counterarguments",
      "Finding overlooked factors",
    ],
    points: [
      "Higher risk of failure",
      "Loss of stability and benefits",
      "Potential work-life balance issues",
      "Opportunity cost",
    ],
  },
  dimensions: [
    { id: "growth", label: "Career Growth", score: 8, scale: 10, tone: "sage" },
    { id: "balance", label: "Work-Life Balance", score: 6, scale: 10, tone: "brass" },
    { id: "money", label: "Financial Impact", score: 7, scale: 10, tone: "sage" },
    { id: "reversible", label: "Reversibility", score: 7, scale: 10, tone: "brass" },
    { id: "risk", label: "Risk Level", score: 5, scale: 10, tone: "terra" },
    { id: "evidence", label: "Evidence Quality", score: 8, scale: 10, tone: "sage" },
  ],
  confidence: {
    value: 68,
    label: "Analysis confidence",
    note: "This reflects how specific and complete the supplied context is. It is not the probability that the decision will succeed.",
  },
  leaning: "Leaning Positive",
  leaningSummary:
    "This decision appears favorable, with several important considerations.",
  bottomLine:
    "The potential for significant career growth and higher compensation makes this a compelling opportunity, but you should carefully consider the financial risk and impact on work-life balance.",
  forPoints: [
    "Significant career growth potential",
    "Higher compensation",
    "More impactful problems",
    "Valuable startup skills",
  ],
  againstPoints: [
    "Higher risk of failure",
    "Loss of stability and benefits",
    "Potential work-life balance issues",
    "Opportunity cost",
  ],
  keyInsights: [
    "The case for leaving rests on growth, pay, and the kind of work, not on a promise that the startup will succeed.",
    "The case against is mostly concentrated risk: income, benefits, and time.",
    "The question is specific enough to compare the two cases, and still missing the facts that would move a verdict: savings, the real offer, and the weekly load.",
  ],
  changeFactors: [
    {
      id: "salary",
      condition: "If salary were lower",
      outcome: "The financial argument becomes weaker.",
      whyItMatters:
        "Pay is doing a lot of the work in the case for leaving. If the offer is closer to your current salary, growth and impact have to stand on their own, and the financial risk weighs more.",
    },
    {
      id: "runway",
      condition: "If you had 12+ months of runway",
      outcome: "The financial risk becomes easier to absorb.",
      whyItMatters:
        "Runway is the difference between a risky experiment and a forced bet. A year of expenses saved makes it possible to learn whether the role is working before stability disappears.",
    },
    {
      id: "balance",
      condition: "If work-life balance worsened",
      outcome: "The overall case becomes less favorable.",
      whyItMatters:
        "Balance is already a real cost, not a footnote. If the role asks for more nights and weekends than you can sustain, the career upside stops being worth the life it consumes.",
    },
  ],
  nextSteps: [
    "Research the startup's funding, team, and runway",
    "Talk to current and former employees",
    "Negotiate compensation and equity terms",
    "Consider whether a trial or consulting arrangement is possible",
    "Calculate your personal financial runway",
  ],
  summary:
    "A prepared reading of this career decision leans positive. The upside is concrete, and so are the costs. The reading would shift if the offer, the savings, or the weekly load turned out worse than this draft assumes.",
};

export const decisionExamples = [
  {
    id: "startup",
    title: "Leave a stable role",
    prompt: demoAnalysis.decision,
    note: "Career, money, and risk",
  },
  {
    id: "city",
    title: "Move for a relationship",
    prompt: "Should I move to another city to be with my partner?",
    note: "Home, work, and the people you love",
  },
  {
    id: "school",
    title: "Go back to school",
    prompt: "Should I leave work for a year to go back to school?",
    note: "Time, tuition, and a different kind of progress",
  },
] as const;

export function findDecisionExample(id: string | null | undefined) {
  return decisionExamples.find((example) => example.id === id);
}
