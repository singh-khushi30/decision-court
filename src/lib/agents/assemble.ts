import type { DecisionAnalysis, DecisionDimension } from "@/types/analysis";
import type { DecisionRequest } from "@/lib/schemas/decision-request";
import {
  type CasesOutput,
  type DimensionKey,
  type EvaluationOutput,
  type JudgeOutput,
  type RepairOutput,
} from "@/lib/schemas/model-output";

const leaningLabel = {
  leaning_positive: "Leaning positive",
  leaning_cautious: "Leaning cautious",
  finely_balanced: "Finely balanced",
  too_uncertain: "Too uncertain to lean",
} as const;

const confidenceNote =
  "This reflects how complete and well-supported the analysis is based on the information supplied. It is not the probability that the decision will succeed.";

const authoritative =
  /you should definitely|the correct decision is|the right decision is/i;

export function toneFor(key: DimensionKey, score: number): DecisionDimension["tone"] {
  const pressureWhenHigh = key === "risk" || key === "time_commitment";
  const pressure = pressureWhenHigh ? score : 10 - score;
  if (pressure >= 7) return "terra";
  if (pressure >= 4) return "brass";
  return "sage";
}

export function languageIssues(parts: string[]): string[] {
  const issues: string[] = [];
  if (parts.some((part) => authoritative.test(part))) {
    issues.push("authoritative_language");
  }
  return issues;
}

export function applyRepair(
  cases: CasesOutput,
  evaluation: EvaluationOutput,
  judge: JudgeOutput,
  repair: RepairOutput,
): { cases: CasesOutput; evaluation: EvaluationOutput; judge: JudgeOutput } {
  return {
    cases: {
      advocate: { ...cases.advocate, strongestArguments: repair.advocateArguments },
      challenger: {
        ...cases.challenger,
        strongestArguments: repair.challengerArguments,
      },
    },
    evaluation: {
      ...evaluation,
      dimensions: repair.dimensions,
      keyInsights: repair.keyInsights,
      changeFactors: repair.changeFactors,
    },
    judge: {
      ...judge,
      verdictLabel: repair.verdictLabel,
      verdictRationale: repair.verdictRationale,
      analysisConfidence: repair.analysisConfidence,
      bottomLine: repair.bottomLine,
      summary: repair.summary,
      nextSteps: repair.nextSteps,
    },
  };
}

export function assembleAnalysis(
  request: DecisionRequest,
  cases: CasesOutput,
  evaluation: EvaluationOutput,
  judge: JudgeOutput,
  id = crypto.randomUUID(),
): DecisionAnalysis {
  const insights = [
    ...evaluation.keyInsights,
    ...evaluation.unresolvedQuestions.slice(0, 2).map((question) => `Still open: ${question}`),
  ].slice(0, 6);

  return {
    id,
    decision: request.decision,
    context: {
      situation: request.context.currentSituation,
      goals: request.context.goals,
      constraints: request.context.constraints,
      timeline: request.context.timeline,
    },
    advocateCase: {
      id: "advocate",
      eyebrow: "The Advocate",
      title: "The case for",
      activity: ["Built only from the context you supplied"],
      points: cases.advocate.strongestArguments,
    },
    challengerCase: {
      id: "challenger",
      eyebrow: "The Challenger",
      title: "The case against",
      activity: ["Stress-tested against the context you supplied"],
      points: cases.challenger.strongestArguments,
    },
    dimensions: evaluation.dimensions.map((dimension) => ({
      id: dimension.key,
      label: dimension.label,
      score: dimension.score,
      scale: 10 as const,
      tone: toneFor(dimension.key, dimension.score),
    })),
    confidence: {
      value: judge.analysisConfidence,
      label: "Analysis confidence",
      note: confidenceNote,
    },
    leaning: leaningLabel[judge.verdictLabel],
    leaningSummary: judge.verdictRationale,
    bottomLine: judge.bottomLine,
    forPoints: cases.advocate.strongestArguments,
    againstPoints: cases.challenger.strongestArguments,
    keyInsights: insights,
    changeFactors: evaluation.changeFactors.map((factor, index) => ({
      id: `factor-${index + 1}`,
      condition: factor.condition,
      outcome: factor.effect,
      whyItMatters: factor.whyItMatters,
    })),
    nextSteps: judge.nextSteps,
    summary: judge.summary,
  };
}

export function publicText(analysis: DecisionAnalysis): string[] {
  return [
    analysis.leaningSummary,
    analysis.bottomLine,
    analysis.summary,
    ...analysis.forPoints,
    ...analysis.againstPoints,
    ...analysis.keyInsights,
    ...analysis.nextSteps,
    ...analysis.changeFactors.flatMap((factor) => [
      factor.condition,
      factor.outcome,
      factor.whyItMatters,
    ]),
  ];
}
