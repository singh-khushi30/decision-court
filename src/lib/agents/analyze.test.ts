import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeDecision } from "@/lib/agents/analyze";
import { analysisJsonShape, analysisSystem } from "@/lib/agents/prompts";
import { ANALYSIS_MAX_OUTPUT_TOKENS } from "@/lib/ai/gemini";
import { resolveGeminiModel } from "@/lib/ai/model";
import { OVERALL_BUDGET_MS } from "@/lib/schemas/limits";
import type { DecisionRequest } from "@/lib/schemas/decision-request";

const request: DecisionRequest = {
  decision: "Should I move cities for a year?",
  context: {
    currentSituation: "I have a lease and a job I can do remotely.",
    goals: "Live closer to my partner.",
    constraints: "I need to keep an income.",
    timeline: "The lease ends in three months.",
  },
};

const modelOutput = {
  advocate: {
    summary: "The move is a bounded experiment with a remote job.",
    strongestArguments: [
      "The relationship gets a real test instead of a long-distance guess.",
      "Remote work keeps income while you learn the city.",
      "The lease ending gives a natural date to try it.",
    ],
    assumptions: ["The remote arrangement survives the move.", "The city is livable on the current income."],
    evidenceStrength: "mixed",
  },
  challenger: {
    summary: "The move concentrates housing, work, and relationship risk.",
    strongestArguments: [
      "A new lease is hard to unwind if the relationship or job shifts.",
      "Being closer does not by itself resolve the underlying questions.",
      "Moving costs arrive before anyone knows if the year works.",
    ],
    assumptions: ["Leaving would be costly within the year.", "A new lease would be hard to exit."],
    evidenceStrength: "mixed",
  },
  evaluation: {
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
      { key: "evidence_quality", label: "Evidence in hand", score: 3, rationale: "The timeline is specific. The costs are not." },
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
  },
  judge: {
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
  },
};

const validJson = JSON.stringify(modelOutput);

function unavailable() {
  return Object.assign(new Error("This model is currently experiencing high demand"), {
    status: 503,
  });
}

describe("one-call analysis", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("turns one valid JSON response into the full report", async () => {
    const calls: Array<{ timeoutMs: number; maxOutputTokens: number; model: string }> = [];
    const result = await analyzeDecision(request, {
      generate: async (input) => {
        calls.push(input);
        expect(input.system).toBe(analysisSystem);
        expect(input.system).toContain("Return ONLY valid JSON");
        expect(input.user).toContain(request.decision);
        expect(input.attempt).toBe(1);
        return validJson;
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.maxOutputTokens).toBe(ANALYSIS_MAX_OUTPUT_TOKENS);
    expect(calls[0]?.maxOutputTokens).toBe(3_500);
    expect(calls[0]?.timeoutMs).toBeLessThanOrEqual(OVERALL_BUDGET_MS);
    expect(calls[0]?.timeoutMs).toBeGreaterThan(OVERALL_BUDGET_MS - 50);
    expect(calls[0]?.model).toBe(resolveGeminiModel());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.decision).toBe(request.decision);
    expect(result.analysis.advocateCase.points).toEqual(modelOutput.advocate.strongestArguments);
    expect(result.analysis.challengerCase.points).toEqual(modelOutput.challenger.strongestArguments);
    expect(result.analysis.forPoints).toEqual(modelOutput.advocate.strongestArguments);
    expect(result.analysis.againstPoints).toEqual(modelOutput.challenger.strongestArguments);
    expect(result.analysis.dimensions.map((dimension) => dimension.id)).toContain("evidence_quality");
    expect(result.analysis.leaning).toBe("Finely balanced");
    expect(result.analysis.confidence.value).toBe(54);
    expect(result.analysis.confidence.note).toMatch(/not the probability/i);
    expect(result.analysis.bottomLine).toBe(modelOutput.judge.bottomLine);
    expect(result.analysis.summary).toBe(modelOutput.judge.summary);
    expect(result.analysis.keyInsights[0]).toBe(modelOutput.evaluation.keyInsights[0]);
    expect(result.analysis.changeFactors[0]?.condition).toBe(modelOutput.evaluation.changeFactors[0]?.condition);
    expect(result.analysis.nextSteps).toEqual(modelOutput.judge.nextSteps);
  });

  it("accepts the compact example as a complete analysis", async () => {
    const calls: number[] = [];
    const result = await analyzeDecision(request, {
      generate: async () => {
        calls.push(1);
        return analysisJsonShape;
      },
    });
    expect(calls).toEqual([1]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.forPoints).toHaveLength(2);
    expect(result.analysis.againstPoints).toHaveLength(2);
    expect(result.analysis.dimensions).toHaveLength(5);
    expect(result.analysis.changeFactors).toHaveLength(2);
    expect(result.analysis.nextSteps).toHaveLength(3);
    expect(result.analysis.bottomLine.length).toBeGreaterThan(0);
    expect(result.analysis.summary.length).toBeGreaterThan(0);
  });

  it("rejects truncated JSON without a second call", async () => {
    const calls: number[] = [];
    const result = await analyzeDecision(request, {
      generate: async () => {
        calls.push(1);
        return `${analysisJsonShape.slice(0, 90)}n`;
      },
    });
    expect(calls).toEqual([1]);
    expect(result).toEqual({
      ok: false,
      failure: { category: "invalid_output", node: "analysis" },
    });
  });

  it("rejects malformed JSON without a second call", async () => {
    const calls: number[] = [];
    const result = await analyzeDecision(request, {
      generate: async () => {
        calls.push(1);
        return "not json SECRET_MODEL_TEXT";
      },
    });
    expect(calls).toEqual([1]);
    expect(result).toEqual({
      ok: false,
      failure: { category: "invalid_output", node: "analysis" },
    });
    expect(JSON.stringify(result)).not.toContain("SECRET_MODEL_TEXT");
  });

  it("logs only structural output diagnostics in development", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");
    try {
      const result = await analyzeDecision(request, {
        generate: async () => "not json SECRET_MODEL_TEXT",
      });
      expect(result).toMatchObject({ ok: false, failure: { category: "invalid_output" } });
      const logged = JSON.parse(String(spy.mock.calls[0]?.[0]));
      expect(logged).toMatchObject({
        event: "model_output_invalid",
        node: "analysis",
        parseStage: "json_parse",
        fenced: false,
        first: "n",
      });
      expect(JSON.stringify(logged)).not.toContain("SECRET_MODEL_TEXT");
      expect(logged).not.toHaveProperty("source");
    } finally {
      vi.unstubAllEnvs();
      spy.mockRestore();
    }
  });

  it("rejects JSON that fails the analysis schema without a second call", async () => {
    const invalid = {
      ...modelOutput,
      evaluation: {
        ...modelOutput.evaluation,
        dimensions: modelOutput.evaluation.dimensions.map((dimension, index) =>
          index === 0 ? { ...dimension, score: 14, rationale: "SECRET_MODEL_TEXT" } : dimension,
        ),
      },
    };
    const calls: number[] = [];
    const result = await analyzeDecision(request, {
      generate: async () => {
        calls.push(1);
        return JSON.stringify(invalid);
      },
    });
    expect(calls).toEqual([1]);
    expect(result).toEqual({
      ok: false,
      failure: { category: "invalid_output", node: "analysis" },
    });
    expect(JSON.stringify(result)).not.toContain("SECRET_MODEL_TEXT");
  });

  it("stops at the 40 second deadline and does not retry", async () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const pending = analyzeDecision(request, {
      generate: (input) => {
        calls.push(input.timeoutMs);
        return new Promise(() => {});
      },
    });
    await vi.advanceTimersByTimeAsync(OVERALL_BUDGET_MS);
    const result = await pending;
    expect(OVERALL_BUDGET_MS).toBe(40_000);
    expect(calls).toEqual([40_000]);
    expect(result).toEqual({
      ok: false,
      failure: { category: "timeout", node: "analysis" },
    });
  });

  it("retries one fast 503 inside the same deadline", async () => {
    let now = 5_000;
    const calls: Array<{ timeoutMs: number; attempt: number }> = [];
    const result = await analyzeDecision(request, {
      now: () => now,
      random: () => 0,
      sleep: async (ms) => {
        now += ms;
      },
      generate: async (input) => {
        calls.push({ timeoutMs: input.timeoutMs, attempt: input.attempt });
        if (calls.length === 1) throw unavailable();
        return validJson;
      },
    });
    expect(calls).toEqual([
      { timeoutMs: 40_000, attempt: 1 },
      { timeoutMs: 39_750, attempt: 2 },
    ]);
    expect(result.ok).toBe(true);
  });

  it("does not start the 503 retry when the deadline cannot hold it", async () => {
    let now = 1_000;
    const calls: number[] = [];
    const result = await analyzeDecision(request, {
      now: () => now,
      random: () => 0,
      sleep: async (ms) => {
        now += ms;
      },
      generate: async () => {
        calls.push(1);
        now += 39_000;
        throw unavailable();
      },
    });
    expect(calls).toEqual([1]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.category).toBe("unavailable");
    expect(result.failure.providerStatus).toBe(503);
  });

  it("returns a controlled failure for an authentication error", async () => {
    const calls: number[] = [];
    const result = await analyzeDecision(request, {
      generate: async () => {
        calls.push(1);
        throw Object.assign(new Error("API key rejected"), { status: 401 });
      },
    });
    expect(calls).toEqual([1]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.category).toBe("authentication");
    expect(result.failure.node).toBe("analysis");
    expect(result.failure.providerStatus).toBe(401);
  });
});
