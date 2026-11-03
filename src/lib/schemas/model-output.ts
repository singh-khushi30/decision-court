import { z } from "zod";

const line = (max: number) => z.string().trim().min(1).max(max);

export const evidenceStrengthSchema = z.enum(["thin", "mixed", "grounded"]);

export const dimensionKeySchema = z.enum([
  "career_growth",
  "financial_impact",
  "risk",
  "work_life_balance",
  "reversibility",
  "evidence_quality",
  "relationships",
  "personal_growth",
  "time_commitment",
  "health",
]);

export type DimensionKey = z.infer<typeof dimensionKeySchema>;

export const caseSideSchema = z.object({
  summary: line(500),
  strongestArguments: z.array(line(280)).min(2).max(5),
  assumptions: z.array(line(280)).min(1).max(4),
  evidenceStrength: evidenceStrengthSchema,
});

export const casesSchema = z.object({
  advocate: caseSideSchema,
  challenger: caseSideSchema,
});

export const dimensionSchema = z.object({
  key: dimensionKeySchema,
  label: line(60),
  score: z.number().min(0).max(10),
  rationale: line(400),
});

export const changeFactorSchema = z.object({
  condition: line(160),
  effect: line(240),
  whyItMatters: line(400),
});

export const evaluationSchema = z.object({
  challengedAssumptions: z.array(line(280)).min(2).max(6),
  unresolvedQuestions: z.array(line(280)).min(1).max(4),
  evidenceQuality: evidenceStrengthSchema,
  dimensions: z.array(dimensionSchema).min(5).max(6),
  keyInsights: z.array(line(400)).min(2).max(4),
  changeFactors: z.array(changeFactorSchema).min(2).max(4),
});

export const verdictLabelSchema = z.enum([
  "leaning_positive",
  "leaning_cautious",
  "finely_balanced",
  "too_uncertain",
]);

export const judgeSchema = z.object({
  verdictLabel: verdictLabelSchema,
  verdictRationale: line(500),
  analysisConfidence: z.number().min(0).max(100),
  confidenceRationale: line(400),
  bottomLine: line(600),
  summary: line(800),
  nextSteps: z.array(line(240)).min(3).max(6),
});

export const repairSchema = z.object({
  advocateArguments: z.array(line(280)).min(2).max(5),
  challengerArguments: z.array(line(280)).min(2).max(5),
  verdictLabel: verdictLabelSchema,
  verdictRationale: line(500),
  analysisConfidence: z.number().min(0).max(100),
  bottomLine: line(600),
  summary: line(800),
  keyInsights: z.array(line(400)).min(2).max(4),
  changeFactors: z.array(changeFactorSchema).min(2).max(4),
  nextSteps: z.array(line(240)).min(3).max(6),
  dimensions: z.array(dimensionSchema).min(5).max(6),
});

export const analysisModelSchema = z.object({
  advocate: caseSideSchema,
  challenger: caseSideSchema,
  evaluation: evaluationSchema,
  judge: judgeSchema,
});

export type CasesOutput = z.infer<typeof casesSchema>;
export type EvaluationOutput = z.infer<typeof evaluationSchema>;
export type JudgeOutput = z.infer<typeof judgeSchema>;
export type RepairOutput = z.infer<typeof repairSchema>;

export function roundScore(value: number): number | null {
  if (!Number.isFinite(value) || value < 0 || value > 10) return null;
  return Math.round(value);
}

export function roundConfidence(value: number): number | null {
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return Math.round(value);
}

export function normalizeEvaluation(value: EvaluationOutput): EvaluationOutput | null {
  const dimensions = [];
  const seen = new Set<string>();

  for (const dimension of value.dimensions) {
    if (seen.has(dimension.key)) return null;
    seen.add(dimension.key);
    const score = roundScore(dimension.score);
    if (score === null) return null;
    dimensions.push({ ...dimension, score });
  }

  if (!seen.has("evidence_quality")) return null;

  return { ...value, dimensions };
}

export function normalizeJudge(value: JudgeOutput): JudgeOutput | null {
  const analysisConfidence = roundConfidence(value.analysisConfidence);
  if (analysisConfidence === null) return null;
  return { ...value, analysisConfidence };
}
