import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import {
  AnalysisError,
  classifyProviderError,
  providerLogFields,
  readProviderDiagnostics,
  shouldRetry,
} from "@/lib/ai/errors";
import { geminiResponseSchema, unsupportedGeminiKeywords } from "@/lib/ai/gemini-schema";
import { logEvent } from "@/lib/ai/log";
import { resolveGeminiFallbackModel, resolveGeminiModel } from "@/lib/ai/model";

const MINIMUM_CALL_MS = 1_500;
export const BUILD_CASES_MAX_OUTPUT_TOKENS = 1_200;
export const EVALUATE_MAX_OUTPUT_TOKENS = 4_000;
export const VERDICT_MAX_OUTPUT_TOKENS = 3_000;
export const REPAIR_MAX_OUTPUT_TOKENS = 3_000;
export const ANALYSIS_MAX_OUTPUT_TOKENS = 3_500;

const nodeOutputTokens: Record<string, number> = {
  build_cases: BUILD_CASES_MAX_OUTPUT_TOKENS,
  evaluate_evidence: EVALUATE_MAX_OUTPUT_TOKENS,
  produce_verdict: VERDICT_MAX_OUTPUT_TOKENS,
  correct_result: REPAIR_MAX_OUTPUT_TOKENS,
};

export function maxOutputTokensForNode(node: string): number {
  return nodeOutputTokens[node] ?? REPAIR_MAX_OUTPUT_TOKENS;
}

export type GenerateStructured = (input: {
  system: string;
  user: string;
  schema: z.ZodType;
  timeoutMs: number;
  maxOutputTokens: number;
  attempt: number;
}) => Promise<unknown>;

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value).length === 0;
  }
  return false;
}

export function geminiChatOptions(
  model: string,
  apiKey: string,
  maxOutputTokens = REPAIR_MAX_OUTPUT_TOKENS,
) {
  // Gemini 3.x uses its own sampling and thinking defaults.
  // The installed SDK thinkingLevel enum is not the Gemini 3.8 thinking-level API,
  // so no thinkingConfig is sent. temperature, topP, and topK are omitted.
  return {
    model,
    apiKey,
    maxRetries: 0,
    maxOutputTokens,
  };
}

async function defaultGenerate(input: {
  system: string;
  user: string;
  schema: z.ZodType;
  timeoutMs: number;
  maxOutputTokens: number;
}): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AnalysisError("authentication", undefined, {
      code: "missing_api_key",
      message: "GEMINI_API_KEY is not set",
    });
  }

  const unsupported = unsupportedGeminiKeywords(geminiResponseSchema(input.schema));
  if (unsupported.length > 0) {
    throw new AnalysisError("invalid_request", undefined, {
      code: "unsupported_response_schema",
      message: `response schema contains unsupported keyword "${unsupported[0]}"`,
    });
  }

  const model = new ChatGoogleGenerativeAI(
    geminiChatOptions(resolveGeminiModel(), apiKey, input.maxOutputTokens),
  );
  const structured = model.withStructuredOutput(input.schema);
  const controller = new AbortController();
  return withHardDeadline(
    structured.invoke(
      [new SystemMessage(input.system), new HumanMessage(input.user)],
      { signal: controller.signal },
    ),
    input.timeoutMs,
    { abort: () => controller.abort() },
  );
}

const FINISH_REASON = /^[A-Z0-9_]+$/;

export type GenerationObservation = {
  finishReason?: string;
  outputTokens?: number;
};

export function readGenerationObservation(message: unknown): GenerationObservation {
  if (!message || typeof message !== "object") return {};
  const record = message as {
    response_metadata?: { finishReason?: unknown };
    additional_kwargs?: { finishReason?: unknown };
    usage_metadata?: { output_tokens?: unknown };
  };
  const finish = safeFinishReason(
    record.response_metadata?.finishReason ?? record.additional_kwargs?.finishReason,
  );
  const outputTokens = safeOutputTokens(record.usage_metadata?.output_tokens);
  return {
    ...(finish ? { finishReason: finish } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
  };
}

function safeFinishReason(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 40 || !FINISH_REASON.test(trimmed)) return undefined;
  return trimmed;
}

function safeOutputTokens(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1_000_000) return undefined;
  return value;
}

function responseText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .join("")
    .trim();
}

export const PRIMARY_RETRY_DELAY_MIN_MS = 250;
export const PRIMARY_RETRY_DELAY_SPAN_MS = 250;

export function primaryRetryDelayMs(random: () => number = Math.random): number {
  const unit = Math.min(1, Math.max(0, random()));
  return PRIMARY_RETRY_DELAY_MIN_MS + Math.floor(unit * PRIMARY_RETRY_DELAY_SPAN_MS);
}

export type RawGenerate = (input: {
  model: string;
  system: string;
  user: string;
  timeoutMs: number;
  maxOutputTokens: number;
  attempt: number;
}) => Promise<string>;

export type RawModelText = {
  text: string;
  requestedModel: string;
  usedModel: string;
  fallbackUsed: boolean;
  attempt: number;
};

export function withHardDeadline<T>(
  provider: Promise<T>,
  timeoutMs: number,
  options: { abort?: () => void; node?: string } = {},
): Promise<T> {
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      options.abort?.();
      reject(new AnalysisError("timeout", options.node));
    }, Math.max(0, timeoutMs));
  });
  const guarded = provider.then(
    (value) => (timedOut ? new Promise<T>(() => {}) : value),
    (error) => {
      if (timedOut) return new Promise<T>(() => {});
      throw error;
    },
  );
  return Promise.race([guarded, deadline]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

async function requestRawText(input: {
  model: string;
  system: string;
  user: string;
  timeoutMs: number;
  maxOutputTokens: number;
}): Promise<{ text: string; observation: GenerationObservation }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AnalysisError("authentication", undefined, {
      code: "missing_api_key",
      message: "GEMINI_API_KEY is not set",
    });
  }

  const model = new ChatGoogleGenerativeAI(
    geminiChatOptions(input.model, apiKey, input.maxOutputTokens),
  );
  const controller = new AbortController();
  const message = await withHardDeadline(
    model.invoke(
      [new SystemMessage(input.system), new HumanMessage(input.user)],
      { signal: controller.signal },
    ),
    input.timeoutMs,
    { abort: () => controller.abort() },
  );
  return {
    text: responseText(message.content),
    observation: readGenerationObservation(message),
  };
}

export type BoundedGenerate = (input: {
  model: string;
  system: string;
  user: string;
  timeoutMs: number;
  maxOutputTokens: number;
}) => Promise<string>;

export async function invokeBoundedText(input: {
  system: string;
  user: string;
  timeoutMs: number;
  maxOutputTokens: number;
  model?: string;
  node?: string;
  generate?: BoundedGenerate;
}): Promise<{ text: string; observation: GenerationObservation }> {
  const node = input.node ?? "analysis";
  const model = input.model ?? resolveGeminiModel();
  if (!input.generate && !process.env.GEMINI_API_KEY?.trim()) {
    throw new AnalysisError("authentication", node, {
      code: "missing_api_key",
      message: "GEMINI_API_KEY is not set",
    });
  }

  if (input.generate) {
    const text = await withHardDeadline(
      Promise.resolve().then(() =>
        input.generate!({
          model,
          system: input.system,
          user: input.user,
          timeoutMs: input.timeoutMs,
          maxOutputTokens: input.maxOutputTokens,
        }),
      ),
      input.timeoutMs,
      { node },
    );
    if (!text.trim()) throw new AnalysisError("empty_output", node);
    return { text, observation: {} };
  }

  const generated = await requestRawText({
    model,
    system: input.system,
    user: input.user,
    timeoutMs: input.timeoutMs,
    maxOutputTokens: input.maxOutputTokens,
  });
  if (!generated.text.trim()) throw new AnalysisError("empty_output", node);
  return generated;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function invokeText(input: {
  node?: string;
  system: string;
  user: string;
  timeoutMs?: number;
  remainingMs?: () => number;
  maxOutputTokens: number;
  requestedModel?: string;
  fallbackModel?: string;
  singleAttempt?: boolean;
  generate?: RawGenerate;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}): Promise<RawModelText> {
  if (!input.generate && !process.env.GEMINI_API_KEY?.trim()) {
    throw new AnalysisError("authentication", input.node, {
      code: "missing_api_key",
      message: "GEMINI_API_KEY is not set",
    });
  }

  const requestedModel = input.requestedModel ?? resolveGeminiModel();
  const fallbackModel = input.fallbackModel ?? resolveGeminiFallbackModel();
  const generate = input.generate ?? (async (attempt) => (await requestRawText(attempt)).text);
  const wait = input.sleep ?? sleep;
  const random = input.random ?? Math.random;
  const endsAt = Date.now() + Math.max(0, input.timeoutMs ?? 0);
  const remaining = input.remainingMs ?? (() => endsAt - Date.now());
  const steps = input.singleAttempt
    ? [{ model: requestedModel, fallbackUsed: false }]
    : [
        { model: requestedModel, fallbackUsed: false },
        { model: requestedModel, fallbackUsed: false },
        ...(fallbackModel !== requestedModel ? [{ model: fallbackModel, fallbackUsed: true }] : []),
      ];
  let lastFailure: AnalysisError | null = null;

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (index > 0) {
      if (!lastFailure || lastFailure.category !== "unavailable") break;
      if (index === 1) {
        const delay = primaryRetryDelayMs(random);
        if (remaining() < MINIMUM_CALL_MS + delay) throw lastFailure;
        await wait(delay);
      }
      if (remaining() < MINIMUM_CALL_MS) throw lastFailure;
    }

    const budget = remaining();
    if (budget < MINIMUM_CALL_MS) {
      throw lastFailure ?? new AnalysisError("timeout", input.node);
    }

    const started = Date.now();
    const attemptInfo = {
      requestedModel,
      usedModel: step.model,
      fallbackUsed: step.fallbackUsed,
      attempt: index + 1,
    };
    try {
      const text = await withHardDeadline(
        generate({
          model: step.model,
          system: input.system,
          user: input.user,
          timeoutMs: budget,
          maxOutputTokens: input.maxOutputTokens,
          attempt: index + 1,
        }),
        budget,
        { node: input.node },
      );
      logEvent("model_attempt", {
        node: input.node,
        attempt: index + 1,
        durationMs: Date.now() - started,
        requestedModel,
        usedModel: step.model,
        fallbackUsed: step.fallbackUsed,
      });
      return { text, ...attemptInfo };
    } catch (error) {
      const category =
        error instanceof AnalysisError ? error.category : classifyProviderError(error);
      const diagnostics =
        error instanceof AnalysisError ? error.diagnostics : readProviderDiagnostics(error);
      const failure = new AnalysisError(category, input.node, diagnostics, attemptInfo);
      logEvent("model_attempt", {
        node: input.node,
        category,
        attempt: index + 1,
        durationMs: Date.now() - started,
        requestedModel,
        usedModel: step.model,
        fallbackUsed: step.fallbackUsed,
        ...providerLogFields(diagnostics),
      });
      if (category !== "unavailable") throw failure;
      lastFailure = failure;
    }
  }

  throw lastFailure ?? new AnalysisError("unavailable", input.node);
}

export async function invokePlain(input: {
  system: string;
  user: string;
  timeoutMs: number;
  maxOutputTokens: number;
}): Promise<void> {
  const generated = await invokeText(input);
  if (!generated.text) throw new AnalysisError("empty_output");
}

export async function invokeStructured<T>(input: {
  node: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  providerSchema?: z.ZodType;
  maxOutputTokens?: number;
  remainingMs: () => number;
  generate?: GenerateStructured;
  allowRetry?: boolean;
}): Promise<T> {
  const generate = input.generate ?? defaultGenerate;
  const providerSchema = input.providerSchema ?? input.schema;
  const maxOutputTokens = input.maxOutputTokens ?? maxOutputTokensForNode(input.node);
  const allowRetry = input.allowRetry !== false;
  const promptChars = input.system.length + input.user.length;
  const schemaChars = JSON.stringify(geminiResponseSchema(providerSchema)).length;
  let attempt = 0;

  while (attempt < 2) {
    attempt += 1;
    const started = Date.now();
    const budget = input.remainingMs();
    if (budget < MINIMUM_CALL_MS) {
      logEvent("provider_failure", {
        node: input.node,
        category: "timeout",
        attempt,
        model: resolveGeminiModel(),
      });
      throw new AnalysisError("timeout", input.node);
    }

    try {
      const raw = await generate({
        system: input.system,
        user: input.user,
        schema: providerSchema,
        timeoutMs: budget,
        maxOutputTokens,
        attempt,
      });
      if (isEmpty(raw)) throw new AnalysisError("empty_output", input.node);

      const parsed = input.schema.safeParse(raw);
      if (!parsed.success) throw new AnalysisError("invalid_output", input.node);

      logEvent("agent_node_completed", {
        node: input.node,
        durationMs: Date.now() - started,
        attempt,
        model: resolveGeminiModel(),
      });
      return parsed.data;
    } catch (error) {
      const category =
        error instanceof AnalysisError ? error.category : classifyProviderError(error);
      const diagnostics =
        error instanceof AnalysisError ? error.diagnostics : readProviderDiagnostics(error);
      const failure = new AnalysisError(category, input.node, diagnostics);
      logEvent("provider_failure", {
        node: input.node,
        category,
        attempt,
        durationMs: Date.now() - started,
        model: resolveGeminiModel(),
        promptChars,
        schemaChars,
        maxOutputTokens,
        timeoutMs: budget,
        ...providerLogFields(diagnostics),
      });
      if (
        allowRetry &&
        shouldRetry(category, attempt, input.remainingMs())
      ) {
        continue;
      }
      throw failure;
    }
  }

  throw new AnalysisError("generic", input.node);
}
