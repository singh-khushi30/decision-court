import { z } from "zod";
import type { DecisionAnalysis } from "@/types/analysis";

const text = z.string().trim().min(1);

export const decisionAnalysisSchema = z.object({
  id: text,
  decision: text,
  context: z.object({
    situation: z.string(),
    goals: z.string(),
    constraints: z.string(),
    timeline: z.string(),
  }),
  advocateCase: z.object({
    id: z.literal("advocate"),
    eyebrow: text,
    title: text,
    activity: z.array(text).min(1),
    points: z.array(text).min(2),
  }),
  challengerCase: z.object({
    id: z.literal("challenger"),
    eyebrow: text,
    title: text,
    activity: z.array(text).min(1),
    points: z.array(text).min(2),
  }),
  dimensions: z
    .array(
      z.object({
        id: text,
        label: text,
        score: z.number().min(0).max(10),
        scale: z.literal(10),
        tone: z.enum(["sage", "brass", "terra"]),
      }),
    )
    .min(5)
    .max(6),
  confidence: z.object({
    value: z.number().min(0).max(100),
    label: text,
    note: text,
  }),
  leaning: text,
  leaningSummary: text,
  bottomLine: text,
  forPoints: z.array(text).min(2),
  againstPoints: z.array(text).min(2),
  keyInsights: z.array(text).min(2),
  changeFactors: z
    .array(
      z.object({
        id: text,
        condition: text,
        outcome: text,
        whyItMatters: text,
      }),
    )
    .min(2),
  nextSteps: z.array(text).min(3),
  summary: text,
});

export function parseDecisionAnalysis(value: unknown): DecisionAnalysis | null {
  const parsed = decisionAnalysisSchema.safeParse(value);
  if (!parsed.success) return null;
  return parsed.data;
}
