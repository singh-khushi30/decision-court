import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import {
  AnalysisError,
  providerLogFields,
  toAnalysisFailure,
  type AnalysisFailure,
} from "@/lib/ai/errors";
import { parseModelJson } from "@/lib/ai/json-output";
import { logEvent } from "@/lib/ai/log";
import {
  applyRepair,
  assembleAnalysis,
  languageIssues,
  publicText,
} from "@/lib/agents/assemble";
import {
  advocateChallengerSystem,
  casesJsonShape,
  casesUserPrompt,
  contextBlock,
  evaluationJsonShape,
  evaluationUserPrompt,
  evaluatorSystem,
  judgeJsonShape,
  judgeSystem,
  judgeUserPrompt,
  jsonRepairSystem,
  jsonRepairUser,
  repairJsonShape,
  repairSystem,
  repairUserPrompt,
} from "@/lib/agents/prompts";
import type { DecisionRequest } from "@/lib/schemas/decision-request";
import { parseDecisionAnalysis } from "@/lib/schemas/decision-analysis";
import {
  casesSchema,
  evaluationSchema,
  judgeSchema,
  normalizeEvaluation,
  normalizeJudge,
  repairSchema,
  type CasesOutput,
  type EvaluationOutput,
  type JudgeOutput,
} from "@/lib/schemas/model-output";
import type { DecisionAnalysis } from "@/types/analysis";

export const decisionGraphNodes = [
  "prepare_context",
  "build_cases",
  "cross_examine",
  "evaluate_evidence",
  "produce_verdict",
  "validate_result",
  "correct_result",
] as const;

const MINIMUM_CALL_MS = 1_500;

export type ModelCaller = (input: {
  node: "build_cases" | "evaluate_evidence" | "produce_verdict" | "correct_result";
  system: string;
  user: string;
  schema: z.ZodType;
  purpose: "generate" | "json_repair";
}) => Promise<unknown>;

type PreparedContext = {
  request: DecisionRequest;
  block: string;
};

const GraphState = Annotation.Root({
  request: Annotation<DecisionRequest>(),
  prepared: Annotation<PreparedContext | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  brief: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
  cases: Annotation<CasesOutput | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  evaluation: Annotation<EvaluationOutput | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  judge: Annotation<JudgeOutput | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  analysis: Annotation<DecisionAnalysis | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  issues: Annotation<string[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  correctionUsed: Annotation<boolean>({
    reducer: (_left, right) => right,
    default: () => false,
  }),
  failure: Annotation<AnalysisFailure | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
});

type GraphUpdate = typeof GraphState.Update;

function assumptionBrief(cases: CasesOutput): string {
  const advocate = cases.advocate.assumptions.map((item) => `Advocate assumption: ${item}`);
  const challenger = cases.challenger.assumptions.map(
    (item) => `Challenger assumption: ${item}`,
  );
  return [...advocate, ...challenger].join("\n");
}

function fail(node: string, error: unknown): GraphUpdate {
  const failure = toAnalysisFailure(node, error);
  logEvent("agent_node_failed", {
    node,
    category: failure.category,
    ...providerLogFields(
      error instanceof AnalysisError ? error.diagnostics : undefined,
    ),
  });
  return { failure };
}

export async function runDecisionAnalysis(
  request: DecisionRequest,
  deps: {
    callModel: ModelCaller;
    remainingMs: () => number;
    modelId: string;
    log?: typeof logEvent;
  },
): Promise<{ ok: true; analysis: DecisionAnalysis } | { ok: false; failure: AnalysisFailure }> {
  const record = deps.log ?? logEvent;

  const jsonShape = {
    build_cases: casesJsonShape,
    evaluate_evidence: evaluationJsonShape,
    produce_verdict: judgeJsonShape,
    correct_result: repairJsonShape,
  } as const;

  async function call<T>(
    node: "build_cases" | "evaluate_evidence" | "produce_verdict" | "correct_result",
    system: string,
    user: string,
    schema: z.ZodType<T>,
    accept?: (value: T) => T | null,
  ): Promise<T> {
    if (deps.remainingMs() < MINIMUM_CALL_MS) {
      throw new AnalysisError("timeout", node);
    }

    const started = Date.now();
    const first = await deps.callModel({ node, system, user, schema, purpose: "generate" });
    let parsed = parseModelJson(first, schema);
    let accepted = parsed.ok ? (accept ? accept(parsed.data) : parsed.data) : null;
    let repaired = false;
    record("model_output_checked", {
      node,
      attempt: 1,
      durationMs: Date.now() - started,
      model: deps.modelId,
      parseSuccess: parsed.parseSuccess,
      validationSuccess: accepted != null,
    });

    if (accepted == null) {
      if (deps.remainingMs() < MINIMUM_CALL_MS) {
        throw new AnalysisError("timeout", node);
      }
      const repairStarted = Date.now();
      const repairText = await deps.callModel({
        node,
        system: jsonRepairSystem,
        user: jsonRepairUser(
          parsed.ok ? ["The JSON failed a domain check."] : parsed.problems,
          parsed.source,
          jsonShape[node],
        ),
        schema,
        purpose: "json_repair",
      });
      repaired = true;
      parsed = parseModelJson(repairText, schema);
      accepted = parsed.ok ? (accept ? accept(parsed.data) : parsed.data) : null;
      record("model_output_checked", {
        node,
        attempt: 2,
        durationMs: Date.now() - repairStarted,
        model: deps.modelId,
        parseSuccess: parsed.parseSuccess,
        validationSuccess: accepted != null,
      });
    }

    if (accepted == null) throw new AnalysisError("invalid_output", node);
    record("agent_node_completed", {
      node,
      durationMs: Date.now() - started,
      model: deps.modelId,
      attempt: repaired ? 2 : 1,
    });
    return accepted;
  }

  const prepareContext = (state: typeof GraphState.State): GraphUpdate => {
    const started = Date.now();
    const prepared = {
      request: state.request,
      block: contextBlock(state.request),
    };
    record("agent_node_completed", {
      node: "prepare_context",
      durationMs: Date.now() - started,
      model: deps.modelId,
    });
    return { prepared };
  };

  const buildCases = async (state: typeof GraphState.State): Promise<GraphUpdate> => {
    try {
      const cases = await call(
        "build_cases",
        advocateChallengerSystem,
        casesUserPrompt(state.request),
        casesSchema,
      );
      return { cases };
    } catch (error) {
      return fail("build_cases", error);
    }
  };

  const crossExamine = (state: typeof GraphState.State): GraphUpdate => {
    if (!state.cases) return fail("cross_examine", new AnalysisError("generic", "cross_examine"));
    const started = Date.now();
    const brief = assumptionBrief(state.cases);
    record("agent_node_completed", {
      node: "cross_examine",
      durationMs: Date.now() - started,
      model: deps.modelId,
    });
    return { brief };
  };

  const evaluateEvidence = async (
    state: typeof GraphState.State,
  ): Promise<GraphUpdate> => {
    if (!state.cases) {
      return fail("evaluate_evidence", new AnalysisError("generic", "evaluate_evidence"));
    }
    try {
      const evaluation = await call(
        "evaluate_evidence",
        evaluatorSystem,
        evaluationUserPrompt(state.request, state.cases, state.brief),
        evaluationSchema,
        normalizeEvaluation,
      );
      return { evaluation };
    } catch (error) {
      return fail("evaluate_evidence", error);
    }
  };

  const produceVerdict = async (state: typeof GraphState.State): Promise<GraphUpdate> => {
    if (!state.cases || !state.evaluation) {
      return fail("produce_verdict", new AnalysisError("generic", "produce_verdict"));
    }
    try {
      const judge = await call(
        "produce_verdict",
        judgeSystem,
        judgeUserPrompt(state.request, state.cases, state.evaluation),
        judgeSchema,
        normalizeJudge,
      );
      return { judge };
    } catch (error) {
      return fail("produce_verdict", error);
    }
  };

  const validateResult = (state: typeof GraphState.State): GraphUpdate => {
    const started = Date.now();
    if (state.failure) return {};
    if (!state.cases || !state.evaluation || !state.judge) {
      return fail("validate_result", new AnalysisError("invalid_output", "validate_result"));
    }

    const analysis = assembleAnalysis(
      state.request,
      state.cases,
      state.evaluation,
      state.judge,
    );
    const parsed = parseDecisionAnalysis(analysis);
    const issues = [
      ...(parsed ? [] : ["schema"]),
      ...languageIssues(publicText(analysis)),
    ];

    if (issues.length === 0 && parsed) {
      record("agent_node_completed", {
        node: "validate_result",
        durationMs: Date.now() - started,
        model: deps.modelId,
      });
      return { analysis: parsed, issues: [] };
    }

    if (state.correctionUsed || deps.remainingMs() < 8_000) {
      return fail("validate_result", new AnalysisError("invalid_output", "validate_result"));
    }

    return { analysis: null, issues };
  };

  const correctResult = async (state: typeof GraphState.State): Promise<GraphUpdate> => {
    if (!state.cases || !state.evaluation || !state.judge) {
      return {
        correctionUsed: true,
        failure: { category: "invalid_output", node: "correct_result" },
      };
    }
    try {
      const repair = await call(
        "correct_result",
        repairSystem,
        repairUserPrompt(state.request, state.issues, {
          cases: state.cases,
          evaluation: state.evaluation,
          judge: state.judge,
        }),
        repairSchema,
      );
      const next = applyRepair(state.cases, state.evaluation, state.judge, repair);
      const evaluation = normalizeEvaluation(next.evaluation);
      const judge = normalizeJudge(next.judge);
      if (!evaluation || !judge) throw new AnalysisError("invalid_output", "correct_result");
      return {
        correctionUsed: true,
        cases: next.cases,
        evaluation,
        judge,
        issues: [],
      };
    } catch (error) {
      return { correctionUsed: true, ...fail("correct_result", error) };
    }
  };

  const route = (state: typeof GraphState.State) => {
    if (state.failure) return END;
    return "continue" as const;
  };

  const afterValidation = (state: typeof GraphState.State) => {
    if (state.failure || state.analysis) return END;
    if (state.issues.length > 0 && !state.correctionUsed) return "correct_result" as const;
    return END;
  };

  const graph = new StateGraph(GraphState)
    .addNode("prepare_context", prepareContext)
    .addNode("build_cases", buildCases)
    .addNode("cross_examine", crossExamine)
    .addNode("evaluate_evidence", evaluateEvidence)
    .addNode("produce_verdict", produceVerdict)
    .addNode("validate_result", validateResult)
    .addNode("correct_result", correctResult)
    .addEdge(START, "prepare_context")
    .addConditionalEdges("prepare_context", route, {
      continue: "build_cases",
      [END]: END,
    })
    .addConditionalEdges("build_cases", route, {
      continue: "cross_examine",
      [END]: END,
    })
    .addConditionalEdges("cross_examine", route, {
      continue: "evaluate_evidence",
      [END]: END,
    })
    .addConditionalEdges("evaluate_evidence", route, {
      continue: "produce_verdict",
      [END]: END,
    })
    .addConditionalEdges("produce_verdict", route, {
      continue: "validate_result",
      [END]: END,
    })
    .addConditionalEdges("validate_result", afterValidation, {
      correct_result: "correct_result",
      [END]: END,
    })
    .addEdge("correct_result", "validate_result")
    .compile();

  try {
    const output = await graph.invoke(
      { request },
      { recursionLimit: 15 },
    );
    if (output.analysis && !output.failure) {
      record("decision_analysis_completed", { model: deps.modelId });
      return { ok: true, analysis: output.analysis };
    }
    return {
      ok: false,
      failure: output.failure ?? { category: "generic", node: "validate_result" },
    };
  } catch {
    return { ok: false, failure: { category: "generic" } };
  }
}
