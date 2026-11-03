import { describe, expect, it } from "vitest";
import {
  decisionRequestError,
  decisionRequestSchema,
} from "@/lib/schemas/decision-request";
import { normalizeEvaluation } from "@/lib/schemas/model-output";
import type { EvaluationOutput } from "@/lib/schemas/model-output";

const evaluation = {
  challengedAssumptions: ["One assumption.", "Another assumption."],
  unresolvedQuestions: ["What is missing?"],
  evidenceQuality: "mixed",
  dimensions: [
    { key: "financial_impact", label: "Money", score: 5, rationale: "Unclear." },
    { key: "risk", label: "Risk", score: 5, rationale: "Unclear." },
    { key: "reversibility", label: "Return", score: 5, rationale: "Unclear." },
    { key: "relationships", label: "People", score: 5, rationale: "Unclear." },
    { key: "evidence_quality", label: "Evidence", score: 5, rationale: "Unclear." },
  ],
  keyInsights: ["One insight.", "Another insight."],
  changeFactors: [
    { condition: "If costs fell", effect: "The case changes.", whyItMatters: "Cost is central." },
    { condition: "If timing slipped", effect: "The case changes.", whyItMatters: "Time is central." },
  ],
} as EvaluationOutput;

describe("decision request", () => {
  it("accepts a decision with optional context", () => {
    const parsed = decisionRequestSchema.parse({
      decision: "  Should I move cities for a year?  ",
    });
    expect(parsed.decision).toBe("Should I move cities for a year?");
    expect(parsed.context.currentSituation).toBe("");
  });

  it("rejects an empty decision", () => {
    const parsed = decisionRequestSchema.safeParse({ decision: "   " });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(decisionRequestError(parsed.error)).toMatch(/describe the decision/i);
  });

  it("rejects an oversized decision or context field", () => {
    expect(
      decisionRequestSchema.safeParse({ decision: "a".repeat(2001) }).success,
    ).toBe(false);
    expect(
      decisionRequestSchema.safeParse({
        decision: "Should I move cities for a year?",
        context: { goals: "g".repeat(1001) },
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed shape", () => {
    expect(decisionRequestSchema.safeParse({ decision: 12 }).success).toBe(false);
    expect(decisionRequestSchema.safeParse(["nope"]).success).toBe(false);
  });
});

describe("evaluation normalization", () => {
  it("rejects a missing evidence dimension, duplicates, and out-of-range scores", () => {
    expect(normalizeEvaluation(evaluation)?.dimensions).toHaveLength(5);
    expect(
      normalizeEvaluation({
        ...evaluation,
        dimensions: evaluation.dimensions.filter((item) => item.key !== "evidence_quality"),
      }),
    ).toBeNull();
    expect(
      normalizeEvaluation({
        ...evaluation,
        dimensions: evaluation.dimensions.map((item) => ({ ...item, key: "risk" })),
      }),
    ).toBeNull();
    expect(
      normalizeEvaluation({
        ...evaluation,
        dimensions: evaluation.dimensions.map((item, index) =>
          index === 0 ? { ...item, score: 11 } : item,
        ),
      }),
    ).toBeNull();
  });
});
