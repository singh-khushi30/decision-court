import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { z } from "zod";
import {
  dimensionKeySchema,
  evidenceStrengthSchema,
  verdictLabelSchema,
} from "@/lib/schemas/model-output";

/**
 * Keywords accepted by the response schema in @google/generative-ai 0.24.1,
 * which @langchain/google-genai 2.3.4 sends as generation_config.response_schema.
 * minItems and maxItems are part of that Schema type. const, minLength,
 * maxLength, minimum, and maximum are not.
 */
const ALLOWED_KEYWORDS = new Set([
  "type",
  "description",
  "nullable",
  "enum",
  "format",
  "items",
  "minItems",
  "maxItems",
  "properties",
  "required",
]);

const ALLOWED_FORMATS = new Set(["enum", "date-time", "float", "double", "int32", "int64"]);

const text = z.string();
const textList = z.array(text);

function texts(min: number, max: number) {
  return z.array(text).min(min).max(max);
}

const caseSideProviderSchema = z.object({
  summary: text,
  strongestArguments: textList,
  assumptions: textList,
  evidenceStrength: evidenceStrengthSchema,
});

export const casesProviderSchema = z.object({
  advocate: caseSideProviderSchema,
  challenger: caseSideProviderSchema,
});

const dimensionProviderSchema = z.object({
  key: dimensionKeySchema,
  label: text,
  score: z.number(),
  rationale: text,
});

const changeFactorProviderSchema = z.object({
  condition: text,
  effect: text,
  whyItMatters: text,
});

export const evaluationProviderSchema = z.object({
  challengedAssumptions: texts(2, 6),
  unresolvedQuestions: texts(1, 4),
  evidenceQuality: evidenceStrengthSchema,
  dimensions: z.array(dimensionProviderSchema).min(5).max(6),
  keyInsights: texts(2, 4),
  changeFactors: z.array(changeFactorProviderSchema).min(2).max(4),
});

export const judgeProviderSchema = z.object({
  verdictLabel: verdictLabelSchema,
  verdictRationale: text,
  analysisConfidence: z.number(),
  confidenceRationale: text,
  bottomLine: text,
  summary: text,
  nextSteps: texts(3, 6),
});

export const repairProviderSchema = z.object({
  advocateArguments: texts(2, 5),
  challengerArguments: texts(2, 5),
  verdictLabel: verdictLabelSchema,
  verdictRationale: text,
  analysisConfidence: z.number(),
  bottomLine: text,
  summary: text,
  keyInsights: texts(2, 4),
  changeFactors: z.array(changeFactorProviderSchema).min(2).max(4),
  nextSteps: texts(3, 6),
  dimensions: z.array(dimensionProviderSchema).min(5).max(6),
});

export const smokeProviderSchema = z.object({
  ok: z.boolean(),
});

const providerSchemaByNode = {
  build_cases: casesProviderSchema,
  evaluate_evidence: evaluationProviderSchema,
  produce_verdict: judgeProviderSchema,
  correct_result: repairProviderSchema,
} as const;

export type GeminiSchemaNode = keyof typeof providerSchemaByNode;

export function providerSchemaForNode(node: GeminiSchemaNode) {
  return providerSchemaByNode[node];
}

function removeUnsupportedMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeUnsupportedMetadata);
  if (!value || typeof value !== "object") return value;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "additionalProperties" || key === "$schema" || key === "strict") continue;
    next[key] = removeUnsupportedMetadata(child);
  }
  return next;
}

export function geminiResponseSchema(schema: z.ZodType): Record<string, unknown> {
  return removeUnsupportedMetadata(toJsonSchema(schema)) as Record<string, unknown>;
}

export function unsupportedGeminiKeywords(schema: unknown, found = new Set<string>()): string[] {
  if (!schema || typeof schema !== "object") return [...found].sort();
  if (Array.isArray(schema)) {
    for (const item of schema) unsupportedGeminiKeywords(item, found);
    return [...found].sort();
  }

  for (const [key, value] of Object.entries(schema)) {
    if (key === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
      for (const child of Object.values(value)) unsupportedGeminiKeywords(child, found);
      continue;
    }
    if (!ALLOWED_KEYWORDS.has(key)) found.add(key);
    if (key === "format" && typeof value === "string" && !ALLOWED_FORMATS.has(value)) found.add("format");
    if (key === "items") unsupportedGeminiKeywords(value, found);
  }

  return [...found].sort();
}
