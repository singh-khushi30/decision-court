import { assembleAnalysis, languageIssues, publicText } from "@/lib/agents/assemble";
import { analysisSystem, analysisUserPrompt } from "@/lib/agents/prompts";
import {
  AnalysisError,
  classifyProviderError,
  readProviderDiagnostics,
  toAnalysisFailure,
  type AnalysisFailure,
} from "@/lib/ai/errors";
import {
  ANALYSIS_MAX_OUTPUT_TOKENS,
  invokeBoundedText,
  primaryRetryDelayMs,
  type BoundedGenerate,
  type GenerationObservation,
} from "@/lib/ai/gemini";
import { logDevelopmentEvent } from "@/lib/ai/log";
import { parseModelJson, type OutputDiagnostic, type SafeOutputIssue } from "@/lib/ai/json-output";
import { resolveGeminiModel } from "@/lib/ai/model";
import type { DecisionAnalysis } from "@/types/analysis";
import type { DecisionRequest } from "@/lib/schemas/decision-request";
import { OVERALL_BUDGET_MS } from "@/lib/schemas/limits";
import {
  analysisModelSchema,
  normalizeEvaluation,
  normalizeJudge,
  type EvaluationOutput,
} from "@/lib/schemas/model-output";
import { parseDecisionAnalysis } from "@/lib/schemas/decision-analysis";

const ANALYSIS_NODE = "analysis";
const MINIMUM_ATTEMPT_MS = 1_500;

export type AnalysisGenerate = (
  input: Parameters<BoundedGenerate>[0] & { attempt: number },
) => Promise<string>;

type AnalyzeOptions = {
  generate?: AnalysisGenerate;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
};

export type AnalysisResult =
  | { ok: true; analysis: DecisionAnalysis }
  | { ok: false; failure: AnalysisFailure };

export function remainingMsUntil(endsAt: number, now: number): number {
  return endsAt - now;
}

export async function analyzeDecision(
  request: DecisionRequest,
  options: AnalyzeOptions = {},
): Promise<AnalysisResult> {
  const now = options.now ?? Date.now;
  const wait =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const endsAt = now() + OVERALL_BUDGET_MS;
  const remaining = () => remainingMsUntil(endsAt, now());

  try {
    const generated = await requestAnalysisText(request, remaining, wait, options);
    return { ok: true, analysis: readAnalysis(request, generated.text, generated.observation) };
  } catch (error) {
    return { ok: false, failure: failureFor(error) };
  }
}

async function requestAnalysisText(
  request: DecisionRequest,
  remaining: () => number,
  wait: (ms: number) => Promise<void>,
  options: AnalyzeOptions,
): Promise<{ text: string; observation: GenerationObservation }> {
  const model = resolveGeminiModel();
  const system = analysisSystem;
  const user = analysisUserPrompt(request);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const budget = remaining();
    if (budget < MINIMUM_ATTEMPT_MS) {
      throw new AnalysisError("timeout", ANALYSIS_NODE);
    }

    try {
      return await invokeBoundedText({
        system,
        user,
        model,
        node: ANALYSIS_NODE,
        timeoutMs: budget,
        maxOutputTokens: ANALYSIS_MAX_OUTPUT_TOKENS,
        generate: options.generate
          ? (input) => options.generate!({ ...input, attempt })
          : undefined,
      });
    } catch (error) {
      const wrapped = asAnalysisError(error);
      if (attempt === 1 && wrapped.category === "unavailable") {
        const delay = primaryRetryDelayMs(options.random ?? Math.random);
        if (remaining() < MINIMUM_ATTEMPT_MS + delay) throw wrapped;
        await wait(delay);
        if (remaining() < MINIMUM_ATTEMPT_MS) throw wrapped;
        continue;
      }
      throw wrapped;
    }
  }

  throw new AnalysisError("timeout", ANALYSIS_NODE);
}

function readAnalysis(
  request: DecisionRequest,
  text: string,
  observation: GenerationObservation = {},
): DecisionAnalysis {
  const parsed = parseModelJson(text, analysisModelSchema);
  if (!parsed.ok) failInvalid(parsed.diagnostic, observation);

  const evaluation = normalizeEvaluation(parsed.data.evaluation);
  const judge = normalizeJudge(parsed.data.judge);
  if (!evaluation || !judge) {
    failInvalid(
      {
        parseStage: "domain_check",
        issues: [evaluation ? judgeIssue() : evaluationIssue(parsed.data.evaluation)],
      },
      observation,
    );
  }

  const analysis = parseDecisionAnalysis(
    assembleAnalysis(
      request,
      { advocate: parsed.data.advocate, challenger: parsed.data.challenger },
      evaluation,
      judge,
    ),
  );
  if (!analysis) failInvalid({ parseStage: "domain_check", issues: [assemblyIssue()] }, observation);
  if (languageIssues(publicText(analysis)).length > 0) {
    failInvalid({ parseStage: "domain_check", issues: [languageIssue()] }, observation);
  }
  return analysis;
}

function failInvalid(
  diagnostic: OutputDiagnostic | { parseStage: "domain_check"; issues: SafeOutputIssue[] },
  observation: GenerationObservation,
): never {
  logDevelopmentEvent("model_output_invalid", {
    node: ANALYSIS_NODE,
    ...diagnostic,
    finishReason: observation.finishReason,
    outputTokens: observation.outputTokens,
  });
  throw new AnalysisError("invalid_output", ANALYSIS_NODE);
}

function evaluationIssue(value: EvaluationOutput): SafeOutputIssue {
  const seen = new Set<string>();
  for (const dimension of value.dimensions) {
    if (seen.has(dimension.key)) {
      return { path: "evaluation.dimensions", code: "duplicate_dimension_key", expected: "unique_key" };
    }
    seen.add(dimension.key);
  }
  if (!seen.has("evidence_quality")) {
    return { path: "evaluation.dimensions", code: "missing_required_key", expected: "evidence_quality" };
  }
  return { path: "evaluation.dimensions", code: "invalid_score", expected: "number" };
}

function judgeIssue(): SafeOutputIssue {
  return { path: "judge.analysisConfidence", code: "invalid_number", expected: "number" };
}

function assemblyIssue(): SafeOutputIssue {
  return { path: "analysis", code: "assembly", expected: "decision_analysis" };
}

function languageIssue(): SafeOutputIssue {
  return { path: "analysis", code: "authoritative_language", expected: "non_authoritative" };
}

function asAnalysisError(error: unknown): AnalysisError {
  if (error instanceof AnalysisError) return error;
  return new AnalysisError(
    classifyProviderError(error),
    ANALYSIS_NODE,
    readProviderDiagnostics(error),
  );
}

function failureFor(error: unknown): AnalysisFailure {
  return toAnalysisFailure(ANALYSIS_NODE, asAnalysisError(error));
}
