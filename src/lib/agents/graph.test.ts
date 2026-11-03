import { describe, expect, it } from "vitest";
import { AnalysisError } from "@/lib/ai/errors";
import { runDecisionAnalysis, type ModelCaller } from "@/lib/agents/graph";
import type { DecisionRequest } from "@/lib/schemas/decision-request";
import type {
  CasesOutput,
  EvaluationOutput,
  JudgeOutput,
  RepairOutput,
} from "@/lib/schemas/model-output";

const request: DecisionRequest = {
  decision: "Should I move cities for a year?",
  context: {
    currentSituation: "I have a lease and a job I can do remotely.",
    goals: "Live closer to my partner.",
    constraints: "I need to keep an income.",
    timeline: "The lease ends in three months.",
  },
};

const cases: CasesOutput = {
  advocate: {
    summary: "The move is a bounded experiment with a remote job.",
    strongestArguments: [
      "The relationship gets a real test instead of a long-distance guess.",
      "Remote work keeps income while you learn the city.",
    ],
    assumptions: ["The remote arrangement survives the move."],
    evidenceStrength: "mixed",
  },
  challenger: {
    summary: "The move concentrates housing, work, and relationship risk.",
    strongestArguments: [
      "A new lease is hard to unwind if the relationship or job shifts.",
      "Being closer does not by itself resolve the underlying questions.",
    ],
    assumptions: ["Leaving would be costly within the year."],
    evidenceStrength: "mixed",
  },
};

const evaluation: EvaluationOutput = {
  challengedAssumptions: [
    "The remote arrangement is treated as stable, but that was not confirmed.",
    "The cost of leaving is assumed, not priced.",
  ],
  unresolvedQuestions: ["What would it cost to return within six months?"],
  evidenceQuality: "mixed",
  dimensions: [
    { key: "relationships", label: "Relationship strain", score: 7, rationale: "Closeness is the stated goal." },
    { key: "financial_impact", label: "Money", score: 5, rationale: "Income may continue, housing may not." },
    { key: "risk", label: "Downside", score: 6, rationale: "Several parts of life would move at once." },
    { key: "reversibility", label: "Ease of return", score: 4, rationale: "A lease can make a return slower." },
    { key: "evidence_quality", label: "Evidence in hand", score: 10, rationale: "The timeline is specific. The costs are not." },
  ],
  keyInsights: [
    "The case for the move is about proximity, not a guarantee the relationship will be easier.",
    "The expensive unknown is how hard it would be to come back.",
  ],
  changeFactors: [
    {
      condition: "If returning within six months were inexpensive",
      effect: "The downside of trying the city gets smaller.",
      whyItMatters: "Reversibility is doing a lot of the work in the case against moving.",
    },
    {
      condition: "If remote work ended",
      effect: "The financial case for moving would weaken.",
      whyItMatters: "Income is what makes the experiment feel survivable.",
    },
  ],
};

const judge: JudgeOutput = {
  verdictLabel: "finely_balanced",
  verdictRationale: "Proximity matters here, and so does the cost of reversing the move.",
  analysisConfidence: 54,
  confidenceRationale: "The timeline is clear. Housing and return costs were not supplied.",
  bottomLine: "This reads as a close call until the cost of moving back is known.",
  summary: "The supplied context supports a careful comparison, not a settled outcome.",
  nextSteps: [
    "Price a return within six months.",
    "Confirm the remote arrangement in writing.",
    "Talk through what a bad month in the new city would look like.",
  ],
};

const repair: RepairOutput = {
  advocateArguments: cases.advocate.strongestArguments,
  challengerArguments: cases.challenger.strongestArguments,
  verdictLabel: "finely_balanced",
  verdictRationale: "Proximity matters here, and so does the cost of reversing the move.",
  analysisConfidence: 54,
  bottomLine: "This reads as a close call until the cost of moving back is known.",
  summary: "The supplied context supports a careful comparison, not a settled outcome.",
  keyInsights: evaluation.keyInsights,
  changeFactors: evaluation.changeFactors,
  nextSteps: judge.nextSteps,
  dimensions: evaluation.dimensions,
};

function caller(impl: ModelCaller): { callModel: ModelCaller; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    callModel: async (input) => {
      calls.push(input.node);
      return impl(input);
    },
  };
}

function run(
  callModel: ModelCaller,
  remainingMs: () => number = () => 50_000,
) {
  return runDecisionAnalysis(request, {
    callModel,
    remainingMs,
    modelId: "gemini-2.5-flash",
    log: () => {},
  });
}

describe("decision graph", () => {
  it("completes a successful run in three model calls", async () => {
    const model = caller(async (input) => {
      if (input.node === "build_cases") return cases;
      if (input.node === "evaluate_evidence") return evaluation;
      if (input.node === "produce_verdict") return judge;
      throw new Error("unexpected call");
    });

    const result = await run(model.callModel);

    expect(model.calls).toEqual([
      "build_cases",
      "evaluate_evidence",
      "produce_verdict",
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.leaning).toBe("Finely balanced");
    expect(result.analysis.dimensions.every((item) => item.score === 10)).toBe(false);
    expect(result.analysis.confidence.note).toMatch(/not the probability/i);
    expect(result.analysis.decision).toBe(request.decision);
  });

  it("stops when the provider fails", async () => {
    const model = caller(async () => {
      throw new AnalysisError("unavailable", "build_cases");
    });

    const result = await run(model.callModel);

    expect(model.calls).toEqual(["build_cases"]);
    expect(result).toEqual({
      ok: false,
      failure: { category: "unavailable", node: "build_cases" },
    });
  });

  it("stops on a timeout before calling the model when the budget is gone", async () => {
    const model = caller(async () => cases);
    const result = await run(model.callModel, () => 0);

    expect(model.calls).toEqual([]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.category).toBe("timeout");
  });

  it("rejects scores outside the scale", async () => {
    const model = caller(async (input) => {
      if (input.node === "build_cases") return cases;
      if (input.node === "evaluate_evidence") {
        return {
          ...evaluation,
          dimensions: evaluation.dimensions.map((item, index) =>
            index === 0 ? { ...item, score: 14 } : item,
          ),
        };
      }
      return judge;
    });

    const result = await run(model.callModel);

    expect(model.calls).toEqual(["build_cases", "evaluate_evidence", "evaluate_evidence"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.category).toBe("invalid_output");
  });

  it("allows one correction and then accepts the repaired analysis", async () => {
    const model = caller(async (input) => {
      if (input.node === "build_cases") return cases;
      if (input.node === "evaluate_evidence") return evaluation;
      if (input.node === "produce_verdict") {
        return { ...judge, verdictRationale: "The correct decision is to move." };
      }
      return repair;
    });

    const result = await run(model.callModel);

    expect(model.calls).toEqual([
      "build_cases",
      "evaluate_evidence",
      "produce_verdict",
      "correct_result",
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.leaningSummary).not.toMatch(/correct decision/i);
  });

  it("does not correct more than once", async () => {
    const model = caller(async (input) => {
      if (input.node === "build_cases") return cases;
      if (input.node === "evaluate_evidence") return evaluation;
      if (input.node === "produce_verdict") {
        return { ...judge, bottomLine: "The correct decision is to move." };
      }
      return { ...repair, bottomLine: "The right decision is to stay." };
    });

    const result = await run(model.callModel);
    const corrections = model.calls.filter((node) => node === "correct_result");

    expect(corrections).toHaveLength(1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.category).toBe("invalid_output");
  });

  it("accepts raw JSON through every model node", async () => {
    const model = caller(async (input) => {
      if (input.node === "build_cases") return JSON.stringify(cases);
      if (input.node === "evaluate_evidence") return JSON.stringify(evaluation);
      if (input.node === "produce_verdict") return JSON.stringify(judge);
      throw new Error("unexpected call");
    });

    const result = await run(model.callModel);
    expect(model.calls).toEqual(["build_cases", "evaluate_evidence", "produce_verdict"]);
    expect(result.ok).toBe(true);
  });

  it("repairs malformed build_cases JSON once", async () => {
    const model = caller(async (input) => {
      if (input.node === "build_cases") {
        return input.purpose === "generate" ? "not json" : JSON.stringify(cases);
      }
      if (input.node === "evaluate_evidence") return JSON.stringify(evaluation);
      if (input.node === "produce_verdict") return JSON.stringify(judge);
      throw new Error("unexpected call");
    });

    const result = await run(model.callModel);
    expect(model.calls).toEqual([
      "build_cases",
      "build_cases",
      "evaluate_evidence",
      "produce_verdict",
    ]);
    expect(result.ok).toBe(true);
  });

  it("fails when the build_cases repair is also invalid", async () => {
    const model = caller(async () => "still not json");
    const result = await run(model.callModel);
    expect(model.calls).toEqual(["build_cases", "build_cases"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.category).toBe("invalid_output");
  });

  it("does not start repair when the provider reaches the deadline", async () => {
    let budget = 20_000;
    const model = caller(async () => {
      budget = 0;
      throw new AnalysisError("timeout", "build_cases");
    });
    const result = await run(model.callModel, () => budget);
    expect(model.calls).toEqual(["build_cases"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.category).toBe("timeout");
  });

  it("does not repair a timeout", async () => {
    const model = caller(async () => {
      throw new AnalysisError("timeout", "build_cases");
    });
    const result = await run(model.callModel);
    expect(model.calls).toEqual(["build_cases"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.category).toBe("timeout");
  });

  it("repairs invalid evaluator JSON once and then continues", async () => {
    const model = caller(async (input) => {
      if (input.node === "build_cases") return JSON.stringify(cases);
      if (input.node === "evaluate_evidence") {
        return input.purpose === "generate" ? "nope" : JSON.stringify(evaluation);
      }
      if (input.node === "produce_verdict") return JSON.stringify(judge);
      throw new Error("unexpected call");
    });
    const result = await run(model.callModel);
    expect(model.calls).toEqual([
      "build_cases",
      "evaluate_evidence",
      "evaluate_evidence",
      "produce_verdict",
    ]);
    expect(result.ok).toBe(true);
  });

  it("fails when the judge JSON stays invalid", async () => {
    const model = caller(async (input) => {
      if (input.node === "build_cases") return cases;
      if (input.node === "evaluate_evidence") return evaluation;
      return "not a verdict";
    });
    const result = await run(model.callModel);
    expect(model.calls).toEqual([
      "build_cases",
      "evaluate_evidence",
      "produce_verdict",
      "produce_verdict",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.category).toBe("invalid_output");
  });

  it("does not start a JSON repair after the deadline is gone", async () => {
    let budget = 20_000;
    const model = caller(async () => {
      budget = 0;
      return "not json";
    });
    const result = await run(model.callModel, () => budget);
    expect(model.calls).toEqual(["build_cases"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.category).toBe("timeout");
  });
});
