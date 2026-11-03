import { describe, expect, it } from "vitest";
import { z } from "zod";
import { invokeStructured } from "@/lib/ai/gemini";
import { runGeminiSmoke } from "@/lib/ai/gemini-smoke";
import {
  casesProviderSchema,
  evaluationProviderSchema,
  geminiResponseSchema,
  judgeProviderSchema,
  providerSchemaForNode,
  repairProviderSchema,
  smokeProviderSchema,
  unsupportedGeminiKeywords,
} from "@/lib/ai/gemini-schema";
import {
  casesSchema,
  dimensionSchema,
  evaluationSchema,
  judgeSchema,
  normalizeEvaluation,
  repairSchema,
  type EvaluationOutput,
} from "@/lib/schemas/model-output";

const providerSchemas = {
  build_cases: casesProviderSchema,
  evaluate_evidence: evaluationProviderSchema,
  produce_verdict: judgeProviderSchema,
  correct_result: repairProviderSchema,
} as const;

const domainSchemas = {
  build_cases: casesSchema,
  evaluate_evidence: evaluationSchema,
  produce_verdict: judgeSchema,
  correct_result: repairSchema,
} as const;

function schemaShape(schema: unknown): unknown {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return null;
  const record = schema as Record<string, unknown>;
  const shape: Record<string, unknown> = { type: record.type };
  if (record.enum) shape.enum = record.enum;
  if (record.required) shape.required = record.required;
  if (record.items) shape.items = schemaShape(record.items);
  if (record.properties && typeof record.properties === "object" && !Array.isArray(record.properties)) {
    shape.properties = Object.fromEntries(
      Object.entries(record.properties).map(([key, value]) => [key, schemaShape(value)]),
    );
  }
  return shape;
}

describe("gemini provider schemas", () => {
  it("traces const to a Zod literal and keeps it out of the smoke schema", () => {
    const literal = JSON.stringify(geminiResponseSchema(z.object({ ok: z.literal(true) })));
    const smoke = JSON.stringify(geminiResponseSchema(smokeProviderSchema));
    expect(literal).toContain('"const":true');
    expect(smoke).not.toContain('"const"');
    expect(unsupportedGeminiKeywords(geminiResponseSchema(smokeProviderSchema))).toEqual([]);
  });

  it("sends no unsupported keywords for the real decision schemas", () => {
    for (const [node, providerSchema] of Object.entries(providerSchemas)) {
      const provider = geminiResponseSchema(providerSchema);
      const domain = geminiResponseSchema(domainSchemas[node as keyof typeof domainSchemas]);
      expect(unsupportedGeminiKeywords(provider), node).toEqual([]);
      expect(JSON.stringify(provider), node).not.toContain('"const"');
      expect(JSON.stringify(domain), node).not.toContain('"const"');
      expect(schemaShape(provider)).toEqual(schemaShape(domain));
      expect(providerSchemaForNode(node as keyof typeof providerSchemas)).toBe(providerSchema);
    }

    expect(JSON.stringify(geminiResponseSchema(casesSchema))).toContain('"minLength"');
    expect(JSON.stringify(geminiResponseSchema(casesProviderSchema))).not.toContain('"minLength"');
    expect(JSON.stringify(geminiResponseSchema(judgeSchema))).toContain('"maximum"');
    expect(JSON.stringify(geminiResponseSchema(judgeProviderSchema))).not.toContain('"maximum"');
    expect(JSON.stringify(geminiResponseSchema(casesProviderSchema))).toContain('"enum"');
    const casesProvider = JSON.stringify(geminiResponseSchema(casesProviderSchema));
    expect(casesProvider).not.toContain('"minItems"');
    expect(casesProvider).not.toContain('"maxItems"');
    expect(casesProvider).not.toContain('"const"');
    expect(casesProvider).not.toContain('"description"');
  });
});

describe("domain validation", () => {
  const side = {
    summary: "One clear reading of the choice.",
    strongestArguments: ["It builds a skill.", "It keeps an option open."],
    assumptions: ["The timeline is real."],
    evidenceStrength: "mixed" as const,
  };

  it("rejects scores and confidence outside their ranges", () => {
    expect(dimensionSchema.safeParse({ ...dimension(4), score: 4 }).success).toBe(true);
    expect(dimensionSchema.safeParse({ ...dimension(0), score: 0 }).success).toBe(true);
    expect(dimensionSchema.safeParse({ ...dimension(10), score: 10 }).success).toBe(true);
    expect(dimensionSchema.safeParse({ ...dimension(11), score: 11 }).success).toBe(false);
    expect(dimensionSchema.safeParse({ ...dimension(-1), score: -1 }).success).toBe(false);
    expect(judgeSchema.safeParse(judge(0)).success).toBe(true);
    expect(judgeSchema.safeParse(judge(100)).success).toBe(true);
    expect(judgeSchema.safeParse(judge(101)).success).toBe(false);
    expect(judgeSchema.safeParse(judge(-1)).success).toBe(false);
  });

  it("rejects missing sections and empty required arrays", () => {
    expect(casesSchema.safeParse({ advocate: side, challenger: side }).success).toBe(true);
    expect(casesSchema.safeParse({ advocate: side }).success).toBe(false);
    expect(
      casesSchema.safeParse({
        advocate: { ...side, strongestArguments: [] },
        challenger: side,
      }).success,
    ).toBe(false);
    expect(
      casesSchema.safeParse({
        advocate: { ...side, assumptions: [] },
        challenger: side,
      }).success,
    ).toBe(false);
    expect(judgeSchema.safeParse({ ...judge(40), nextSteps: [] }).success).toBe(false);
    const { bottomLine, ...withoutBottomLine } = judge(40);
    expect(bottomLine.length).toBeGreaterThan(0);
    expect(judgeSchema.safeParse(withoutBottomLine).success).toBe(false);
  });

  it("still requires the evidence quality dimension", () => {
    const evaluation = evaluationSchema.parse(validEvaluation());
    const withoutEvidence = {
      ...evaluation,
      dimensions: evaluation.dimensions.filter((item) => item.key !== "evidence_quality"),
    };
    expect(normalizeEvaluation(withoutEvidence as EvaluationOutput)).toBeNull();
  });

  it("checks the smoke value after the provider schema accepts a boolean", async () => {
    const accepted = await runGeminiSmoke(async () => '{"ok": true}');
    const rejected = await runGeminiSmoke(async () => '{"ok": false}');
    expect(accepted).toMatchObject({ success: true });
    expect(accepted).not.toHaveProperty("ok");
    expect(rejected).toMatchObject({
      success: false,
      category: "invalid_output",
      message: "Smoke check expected ok to be true.",
    });
    expect(rejected.message).not.toContain("false");
    expect(rejected).not.toHaveProperty("ok");
  });

  it("applies the strict domain schema after a looser provider schema", async () => {
    let sent = "";
    await expect(
      invokeStructured({
        node: "evaluate_evidence",
        system: "system",
        user: "user",
        schema: z.object({ score: z.number().min(0).max(10) }),
        providerSchema: z.object({ score: z.number() }),
        remainingMs: () => 20_000,
        generate: async ({ schema }) => {
          sent = JSON.stringify(geminiResponseSchema(schema));
          return { score: 14 };
        },
      }),
    ).rejects.toMatchObject({ category: "invalid_output" });
    expect(sent).not.toContain('"minimum"');
    expect(sent).not.toContain('"maximum"');
    expect(sent).not.toContain('"const"');
  });
});

function dimension(score: number) {
  return {
    key: "risk" as const,
    label: "Risk",
    score,
    rationale: "The downside is concrete and near term.",
  };
}

function judge(confidence: number) {
  return {
    verdictLabel: "finely_balanced" as const,
    verdictRationale: "Both sides remain plausible on the current record.",
    analysisConfidence: confidence,
    confidenceRationale: "The supplied context leaves several facts open.",
    bottomLine: "The record supports a careful reading.",
    summary: "The two cases pull in different directions.",
    nextSteps: ["Write the assumption down.", "Ask for the missing number.", "Set a review date."],
  };
}

function validEvaluation() {
  const keys = [
    "career_growth",
    "financial_impact",
    "risk",
    "work_life_balance",
    "evidence_quality",
  ] as const;
  return {
    challengedAssumptions: ["The timeline is fixed.", "The cost is already known."],
    unresolvedQuestions: ["What happens if the offer changes?"],
    evidenceQuality: "mixed" as const,
    dimensions: keys.map((key, index) => ({
      key,
      label: key,
      score: index,
      rationale: "This is a bounded indicator, not a probability.",
    })),
    keyInsights: ["The record is incomplete.", "Both cases depend on the timeline."],
    changeFactors: [
      {
        condition: "The start date moves.",
        effect: "The risk reading changes.",
        whyItMatters: "Time pressure is doing a lot of the work.",
      },
      {
        condition: "A written budget appears.",
        effect: "The financial reading gets firmer.",
        whyItMatters: "The current cost is still an assumption.",
      },
    ],
  };
}
