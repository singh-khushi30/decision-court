import { z } from "zod";
import {
  AnalysisError,
  classifyProviderError,
  readProviderDiagnostics,
} from "@/lib/ai/errors";
import { invokeText } from "@/lib/ai/gemini";
import { parseModelJson } from "@/lib/ai/json-output";
import { resolveGeminiModel } from "@/lib/ai/model";

const smokeSchema = z.object({ ok: z.boolean() });

export type GenerateText = (input: {
  system: string;
  user: string;
  timeoutMs: number;
  maxOutputTokens: number;
}) => Promise<string>;

export const SMOKE_TIMEOUT_MS = 45_000;

export type GeminiSmokeReport = {
  model: string;
  success: boolean;
  durationMs: number;
  category?: string;
  status?: number;
  code?: string;
  message?: string;
};

export async function runGeminiSmoke(generate?: GenerateText): Promise<GeminiSmokeReport> {
  const model = resolveGeminiModel();
  const started = Date.now();
  const request = {
    system: "Return ONLY valid JSON. No markdown. No commentary. Do not include chain-of-thought.",
    user: 'Return {"ok": true}',
    timeoutMs: SMOKE_TIMEOUT_MS,
    maxOutputTokens: 1_000,
  };

  try {
    const text = generate ? await generate(request) : (await invokeText(request)).text;
    const parsed = parseModelJson(text, smokeSchema);
    if (!parsed.ok || parsed.data.ok !== true) {
      return {
        model,
        success: false,
        durationMs: Date.now() - started,
        category: "invalid_output",
        message: "Smoke check expected ok to be true.",
      };
    }
    return { model, success: true, durationMs: Date.now() - started };
  } catch (error) {
    const category =
      error instanceof AnalysisError ? error.category : classifyProviderError(error);
    const diagnostics =
      error instanceof AnalysisError && error.diagnostics
        ? error.diagnostics
        : readProviderDiagnostics(error);
    return {
      model,
      success: false,
      durationMs: Date.now() - started,
      category,
      ...(diagnostics?.status !== undefined ? { status: diagnostics.status } : {}),
      ...(diagnostics?.code ? { code: diagnostics.code } : {}),
      ...(diagnostics?.message ? { message: diagnostics.message } : {}),
    };
  }
}
