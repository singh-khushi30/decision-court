import { z } from "zod";
import { advocateChallengerSystem, casesUserPrompt } from "@/lib/agents/prompts";
import { BUILD_CASES_MAX_OUTPUT_TOKENS } from "@/lib/ai/gemini";
import { casesProviderSchema, geminiResponseSchema } from "@/lib/ai/gemini-schema";
import type { DecisionRequest } from "@/lib/schemas/decision-request";

export const ISOLATION_MAX_OUTPUT_TOKENS = 1_000;
export const CASES_DIAGNOSTIC_TIMEOUT_MS = 45_000;

export const casesDiagnosticRequest: DecisionRequest = {
  decision: "Should a fictional professional leave a stable job for an early-stage startup?",
  context: {
    currentSituation: "The person has a stable salaried role.",
    goals: "More ownership and learning.",
    constraints: "Needs income to cover rent.",
    timeline: "A decision within two months.",
  },
};

export const simpleCasesSchema = z.object({
  forArguments: z.array(z.string()),
  againstArguments: z.array(z.string()),
});

const isolationReply = "Reply with exactly 3 short arguments for and 3 short arguments against. No explanation. No chain-of-thought.";

export function isolationPrompts(request: DecisionRequest = casesDiagnosticRequest) {
  const system = advocateChallengerSystem;
  const user = `${casesUserPrompt(request)}\n\n${isolationReply}`;
  return {
    system,
    user,
    promptChars: system.length + user.length,
  };
}

export function casesDiagnosticMeta(request: DecisionRequest = casesDiagnosticRequest) {
  const system = advocateChallengerSystem;
  const user = casesUserPrompt(request);
  const schema = JSON.stringify(geminiResponseSchema(casesProviderSchema));
  return {
    systemChars: system.length,
    userChars: user.length,
    promptChars: system.length + user.length,
    schemaChars: schema.length,
    maxOutputTokens: BUILD_CASES_MAX_OUTPUT_TOKENS,
    timeoutMs: CASES_DIAGNOSTIC_TIMEOUT_MS,
  };
}
