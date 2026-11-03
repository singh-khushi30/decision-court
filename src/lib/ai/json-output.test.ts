import { describe, expect, it } from "vitest";
import { z } from "zod";
import { analysisJsonShape, analysisSystem } from "@/lib/agents/prompts";
import { extractJsonText, parseModelJson } from "@/lib/ai/json-output";
import {
  analysisModelSchema,
  casesSchema,
  judgeSchema,
  normalizeEvaluation,
  normalizeJudge,
} from "@/lib/schemas/model-output";

const tiny = z.object({
  ok: z.boolean(),
  score: z.number().min(0).max(10),
  label: z.enum(["thin", "mixed", "grounded"]),
  points: z.array(z.string()).min(2).max(4),
});

const valid = {
  ok: true,
  score: 4,
  label: "mixed",
  points: ["one", "two"],
};

describe("json extraction", () => {
  it("accepts pure JSON and surrounding whitespace", () => {
    expect(parseModelJson(JSON.stringify(valid), tiny).ok).toBe(true);
    expect(parseModelJson(`\n  ${JSON.stringify(valid)}\n`, tiny).ok).toBe(true);
  });

  it("accepts one fenced JSON block", () => {
    const body = JSON.stringify(valid);
    expect(extractJsonText(`\`\`\`json\n${body}\n\`\`\``)).toBe(body);
    expect(extractJsonText(`\`\`\`\n${body}\n\`\`\``)).toBe(body);
    expect(parseModelJson(`\`\`\`json\n${body}\n\`\`\``, tiny).ok).toBe(true);
    expect(parseModelJson(`\`\`\`\n${body}\n\`\`\``, tiny).ok).toBe(true);
  });

  it("rejects malformed JSON and prose around JSON", () => {
    expect(parseModelJson("{", tiny)).toMatchObject({ ok: false, parseSuccess: false });
    expect(parseModelJson(`Here is the result ${JSON.stringify(valid)}`, tiny)).toMatchObject({
      ok: false,
      parseSuccess: false,
    });
    expect(parseModelJson(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\`\nThanks`, tiny)).toMatchObject({
      ok: false,
      parseSuccess: false,
    });
  });

  it("rejects JSON that fails the domain schema", () => {
    expect(parseModelJson(JSON.stringify({ ...valid, label: "certain" }), tiny)).toMatchObject({
      ok: false,
      parseSuccess: true,
      validationSuccess: false,
    });
    expect(parseModelJson(JSON.stringify({ ...valid, score: 14 }), tiny)).toMatchObject({
      ok: false,
      parseSuccess: true,
      validationSuccess: false,
    });
    expect(parseModelJson(JSON.stringify({ ...valid, score: -1 }), tiny)).toMatchObject({
      ok: false,
      validationSuccess: false,
    });
    const { points, ...missing } = valid;
    expect(points).toHaveLength(2);
    expect(parseModelJson(JSON.stringify(missing), tiny)).toMatchObject({
      ok: false,
      validationSuccess: false,
    });
    expect(parseModelJson(JSON.stringify({ ...valid, points: ["only"] }), tiny)).toMatchObject({
      ok: false,
      validationSuccess: false,
    });
  });

  it("keeps the full cases and judge schemas authoritative", () => {
    expect(parseModelJson('{"advocate":{}}', casesSchema)).toMatchObject({
      ok: false,
      validationSuccess: false,
    });
    expect(parseModelJson('{"verdictLabel":"certain","analysisConfidence":140}', judgeSchema)).toMatchObject({
      ok: false,
      validationSuccess: false,
    });
  });

  it("asks the model for JSON that satisfies the analysis schema", () => {
    for (const field of [
      "advocate",
      "challenger",
      "evaluation",
      "judge",
      "strongestArguments",
      "assumptions",
      "evidenceStrength",
      "challengedAssumptions",
      "unresolvedQuestions",
      "evidenceQuality",
      "dimensions",
      "keyInsights",
      "changeFactors",
      "verdictLabel",
      "verdictRationale",
      "analysisConfidence",
      "confidenceRationale",
      "bottomLine",
      "summary",
      "nextSteps",
      "evidence_quality",
    ]) {
      expect(analysisSystem).toContain(field);
    }
    expect(analysisSystem).toContain("Return ONLY valid JSON");
    expect(analysisSystem).toContain("No markdown");
    expect(analysisSystem).toContain("No code fences");
    expect(analysisSystem).toContain("strongestArguments with exactly 2");
    expect(analysisSystem).toContain("assumptions with exactly 1");
    expect(analysisSystem).toContain("dimensions with exactly 5");
    expect(analysisSystem).not.toContain("strongestArguments with exactly 3");
    expect(analysisJsonShape).not.toContain("thin|mixed");
    expect(analysisJsonShape).not.toContain("leaning_positive|");
    const parsed = parseModelJson(analysisJsonShape, analysisModelSchema);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.advocate.strongestArguments).toHaveLength(2);
    expect(parsed.data.advocate.assumptions).toHaveLength(1);
    expect(parsed.data.challenger.strongestArguments).toHaveLength(2);
    expect(parsed.data.evaluation.dimensions).toHaveLength(5);
    expect(parsed.data.evaluation.dimensions.some((dimension) => dimension.key === "evidence_quality")).toBe(true);
    expect(parsed.data.evaluation.changeFactors).toHaveLength(2);
    expect(parsed.data.judge.nextSteps).toHaveLength(3);
    expect(normalizeEvaluation(parsed.data.evaluation)).not.toBeNull();
    expect(normalizeJudge(parsed.data.judge)).not.toBeNull();
  });

  it("rejects truncated JSON before schema validation", () => {
    const raw = `${analysisJsonShape.slice(0, 90)}n`;
    const parsed = parseModelJson(raw, analysisModelSchema);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.diagnostic).toMatchObject({
      parseStage: "json_parse",
      fenced: false,
      first: "{",
      last: "n",
    });
    expect(JSON.stringify(parsed.diagnostic)).not.toContain(analysisJsonShape.slice(2, 40));
  });

  it("reports a JSON failure without the response text", () => {
    const raw = "```json\nnot json SECRET_MODEL_TEXT\n```";
    const parsed = parseModelJson(raw, tiny);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.diagnostic).toEqual({
      parseStage: "json_parse",
      responseLength: raw.length,
      fenced: true,
      first: "`",
      last: "`",
    });
    expect(JSON.stringify(parsed.diagnostic)).not.toContain("SECRET_MODEL_TEXT");
  });

  it("reports schema issues without model text", () => {
    const raw = JSON.stringify({
      ok: true,
      label: "SECRET_MODEL_TEXT",
      score: "nope",
      points: ["only"],
    });
    const parsed = parseModelJson(raw, tiny);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.diagnostic.parseStage).toBe("zod_validation");
    if (parsed.diagnostic.parseStage !== "zod_validation") return;
    expect(parsed.diagnostic.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "label", code: "invalid_value", expected: "enum" }),
        expect.objectContaining({ path: "score", code: "invalid_type", expected: "number", received: "string" }),
        expect.objectContaining({ path: "points", code: "too_small", expected: "array", received: "array", bound: 2 }),
      ]),
    );
    const logged = JSON.stringify(parsed.diagnostic);
    expect(logged).not.toContain("SECRET_MODEL_TEXT");
    expect(logged).not.toContain("nope");
    expect(logged).not.toContain("only");
  });
});
