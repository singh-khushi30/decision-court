import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  classifyProviderError,
  sanitizeProviderMessage,
  shouldRetry,
} from "@/lib/ai/errors";
import {
  BUILD_CASES_MAX_OUTPUT_TOKENS,
  geminiChatOptions,
  invokeStructured,
  invokeText,
  maxOutputTokensForNode,
  readGenerationObservation,
  primaryRetryDelayMs,
  withHardDeadline,
} from "@/lib/ai/gemini";
import {
  CASES_DIAGNOSTIC_TIMEOUT_MS,
  casesDiagnosticMeta,
  casesDiagnosticRequest,
  isolationPrompts,
  simpleCasesSchema,
} from "@/lib/ai/gemini-cases-diagnostic";
import { parseModelJson } from "@/lib/ai/json-output";
import { geminiResponseSchema, unsupportedGeminiKeywords } from "@/lib/ai/gemini-schema";
import { remainingMsUntil } from "@/lib/agents/analyze";
import { advocateChallengerSystem, casesUserPrompt } from "@/lib/agents/prompts";
import { runGeminiSmoke, SMOKE_TIMEOUT_MS } from "@/lib/ai/gemini-smoke";
import { logDevelopmentEvent, logEvent } from "@/lib/ai/log";
import { analysisMessages, messageForCategory } from "@/lib/ai/messages";
import {
  DEFAULT_GEMINI_FALLBACK_MODEL,
  DEFAULT_GEMINI_MODEL,
  resolveGeminiFallbackModel,
  resolveGeminiModel,
} from "@/lib/ai/model";
import { OVERALL_BUDGET_MS } from "@/lib/schemas/limits";
import packageJson from "../../../package.json";
import {
  casesSchema,
  evaluationSchema,
  judgeSchema,
  repairSchema,
} from "@/lib/schemas/model-output";

const schema = z.object({ ok: z.literal(true) });

describe("gemini model configuration", () => {
  it("uses gemini-3.8-flash when GEMINI_MODEL is empty", () => {
    expect(resolveGeminiModel({ GEMINI_MODEL: "  " })).toBe(DEFAULT_GEMINI_MODEL);
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.8-flash");
    expect(resolveGeminiModel({ GEMINI_MODEL: "gemini-2.0-flash" })).toBe("gemini-2.0-flash");
    expect(resolveGeminiFallbackModel({ GEMINI_FALLBACK_MODEL: "  " })).toBe(
      DEFAULT_GEMINI_FALLBACK_MODEL,
    );
    expect(DEFAULT_GEMINI_FALLBACK_MODEL).toBe("gemini-3.6-flash");
    expect(resolveGeminiFallbackModel({ GEMINI_FALLBACK_MODEL: "gemini-3.6-flash" })).toBe(
      "gemini-3.6-flash",
    );
  });
});

describe("provider errors", () => {
  it("distinguishes provider failures without using the message as the thrown error", () => {
    expect(classifyProviderError({ status: 429, message: "quota for a private decision" })).toBe(
      "rate_limit",
    );
    expect(classifyProviderError({ status: 400, code: "INVALID_ARGUMENT" })).toBe(
      "invalid_request",
    );
    expect(
      classifyProviderError({
        status: 400,
        error: { code: 400, status: "INVALID_ARGUMENT", message: "Request contains an invalid argument." },
      }),
    ).toBe("invalid_request");
    expect(classifyProviderError({ status: 401, message: "API key not valid" })).toBe(
      "authentication",
    );
    expect(classifyProviderError({ status: 403 })).toBe("authentication");
    expect(classifyProviderError({ code: "PERMISSION_DENIED", message: "permission denied" })).toBe(
      "authentication",
    );
    expect(
      classifyProviderError({
        error: { code: 400, status: "UNAUTHENTICATED", message: "API key not valid" },
      }),
    ).toBe("authentication");
    expect(classifyProviderError({ status: 404 })).toBe("model_not_found");
    expect(classifyProviderError({ code: "NOT_FOUND", message: "model gemini-2.5-flash is not found" })).toBe(
      "model_not_found",
    );
    expect(classifyProviderError({ status: 503 })).toBe("unavailable");
    expect(
      classifyProviderError({ message: "This model is currently experiencing high demand" }),
    ).toBe("unavailable");
    expect(classifyProviderError({ name: "AbortError", message: "This operation was aborted" })).toBe(
      "timeout",
    );
    expect(classifyProviderError({ name: "ZodError" })).toBe("invalid_output");
    expect(shouldRetry("invalid_request", 1, 30_000)).toBe(false);
    expect(shouldRetry("authentication", 1, 30_000)).toBe(false);
    expect(shouldRetry("model_not_found", 1, 30_000)).toBe(false);
    expect(shouldRetry("unavailable", 1, 30_000)).toBe(true);
    expect(shouldRetry("unavailable", 2, 30_000)).toBe(false);
    expect(shouldRetry("invalid_output", 1, 3_000)).toBe(false);
  });

  it("keeps integration failures off the browser", () => {
    for (const category of ["authentication", "invalid_request", "model_not_found"]) {
      expect(messageForCategory(category)).toEqual({
        status: 500,
        message: analysisMessages.unavailable,
      });
    }
  });

  it("redacts secrets from provider messages", () => {
    const message = sanitizeProviderMessage(
      "Request failed https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyABCDEFGHIJKLMNOP {\"contents\":\"private decision\"}",
    );
    expect(message).not.toContain("AIza");
    expect(message).not.toContain("private decision");
    expect(message).not.toContain("https://");
    expect(message.length).toBeLessThanOrEqual(180);
  });
});

describe("structured calls", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it("does not send sampling parameters or a thinking override", () => {
    const options = geminiChatOptions("gemini-3.8-flash", "test-key");
    expect(options).toEqual({
      model: "gemini-3.8-flash",
      apiKey: "test-key",
      maxRetries: 0,
      maxOutputTokens: 3_000,
    });
    expect(options).not.toHaveProperty("temperature");
    expect(options).not.toHaveProperty("topP");
    expect(options).not.toHaveProperty("topK");
    expect(options).not.toHaveProperty("thinkingConfig");
    expect(options).not.toHaveProperty("thinkingBudget");
  });

  it("gives build_cases its own output budget and passes the deadline in milliseconds", async () => {
    expect(maxOutputTokensForNode("build_cases")).toBe(BUILD_CASES_MAX_OUTPUT_TOKENS);
    expect(BUILD_CASES_MAX_OUTPUT_TOKENS).toBe(1_200);
    expect(maxOutputTokensForNode("evaluate_evidence")).toBe(4_000);
    expect(maxOutputTokensForNode("produce_verdict")).toBe(3_000);
    expect(maxOutputTokensForNode("correct_result")).toBe(3_000);
    expect(geminiChatOptions("gemini-3.8-flash", "test-key", 1_200).maxOutputTokens).toBe(1_200);

    const endsAt = 1_700_000_000_000;
    expect(remainingMsUntil(endsAt, endsAt - 55_000)).toBe(55_000);
    expect(remainingMsUntil(endsAt, endsAt)).toBe(0);

    let timeoutMs = 0;
    let maxOutputTokens = 0;
    await invokeStructured({
      node: "build_cases",
      system: "system",
      user: "user",
      schema,
      remainingMs: () => 55_000,
      generate: async (input) => {
        timeoutMs = input.timeoutMs;
        maxOutputTokens = input.maxOutputTokens;
        return { ok: true };
      },
    });
    expect(timeoutMs).toBe(55_000);
    expect(maxOutputTokens).toBe(1_200);
  });

  it("keeps the cases diagnostic out of automated tests", () => {
    expect(packageJson.scripts.test).toBe("vitest run");
    expect(packageJson.scripts["test:gemini"]).toBe("node scripts/gemini-smoke.mjs");
    const scriptNames = Object.keys(packageJson.scripts);
    expect(scriptNames).not.toContain("test:gemini:cases");
    expect(scriptNames).not.toContain("test:gemini:cases:fallback");
    expect(scriptNames).not.toContain("test:gemini:cases:raw");
    expect(scriptNames).not.toContain("test:gemini:cases:simple");
    expect(packageJson.scripts.test.includes("gemini")).toBe(false);
    expect(packageJson.scripts.build.includes("gemini")).toBe(false);
    const meta = casesDiagnosticMeta();
    expect(meta.timeoutMs).toBe(45_000);
    expect(meta.maxOutputTokens).toBe(1_200);
    expect(meta.systemChars).toBe(advocateChallengerSystem.length);
    expect(meta.userChars).toBe(casesUserPrompt(casesDiagnosticRequest).length);
    expect(meta.promptChars).toBe(advocateChallengerSystem.length + casesUserPrompt(casesDiagnosticRequest).length);
    expect(advocateChallengerSystem).toContain("exactly 3 concise arguments");
    expect(advocateChallengerSystem).toContain("exactly 2 concise assumptions");
    expect(advocateChallengerSystem).not.toMatch(/dimension|confidence|evaluator|judge/i);
    const analyzeSource = readFileSync(path.join(process.cwd(), "src/lib/agents/analyze.ts"), "utf8");
    const graphSource = readFileSync(path.join(process.cwd(), "src/lib/agents/graph.ts"), "utf8");
    expect(analyzeSource).toContain("invokeBoundedText");
    expect(analyzeSource).not.toContain("runDecisionAnalysis");
    expect(analyzeSource).toContain("remainingMs");
    expect(analyzeSource).not.toContain("withStructuredOutput");
    expect(analyzeSource).not.toContain("invokeStructured");
    expect(graphSource).not.toContain("withStructuredOutput");
    expect(meta.promptChars).toBeGreaterThan(0);
    expect(meta.schemaChars).toBeGreaterThan(0);
    expect(meta.systemChars).toBeGreaterThan(0);

    const prompts = isolationPrompts();
    expect(prompts.system).toBe(advocateChallengerSystem);
    expect(prompts.user.startsWith("The text between the markers")).toBe(true);
    expect(prompts.user).toContain("3 short arguments for");
    expect(prompts.promptChars).toBe(prompts.system.length + prompts.user.length);
    const simple = JSON.stringify(geminiResponseSchema(simpleCasesSchema));
    expect(unsupportedGeminiKeywords(geminiResponseSchema(simpleCasesSchema))).toEqual([]);
    expect(simple).not.toContain('"const"');
    expect(simple).not.toContain('"enum"');
    expect(simple).not.toContain('"minItems"');
    expect(simple).toContain('"forArguments"');
    expect(simple).toContain('"againstArguments"');
    const side = {
      summary: "A short case.",
      strongestArguments: ["One clear point.", "A second point.", "A third point."],
      assumptions: ["The stated goal holds.", "The stated constraint holds."],
      evidenceStrength: "mixed" as const,
    };
    const parsed = parseModelJson(
      JSON.stringify({ advocate: side, challenger: { ...side, evidenceStrength: "thin" } }),
      casesSchema,
    );
    expect(parsed.ok).toBe(true);
    expect(
      casesSchema.safeParse({
        advocate: { ...side, strongestArguments: ["Only one."] },
        challenger: side,
      }).success,
    ).toBe(false);

    expect(geminiChatOptions("gemini-3.8-flash", "test-key", 1_000)).toEqual({
      model: "gemini-3.8-flash",
      apiKey: "test-key",
      maxRetries: 0,
      maxOutputTokens: 1_000,
    });
  });

  it("gives the manual smoke request 45 seconds", async () => {
    expect(SMOKE_TIMEOUT_MS).toBe(45_000);
    let timeoutMs = 0;
    const report = await runGeminiSmoke(async (input) => {
      timeoutMs = input.timeoutMs;
      return '{"ok": true}';
    });
    expect(timeoutMs).toBe(45_000);
    expect(report.success).toBe(true);
  });

  it("refuses a const response schema before calling Gemini", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    await expect(
      invokeStructured({
        node: "smoke",
        system: "system",
        user: "user",
        schema: z.object({ ok: z.literal(true) }),
        remainingMs: () => 20_000,
      }),
    ).rejects.toMatchObject({
      category: "invalid_request",
      message: "invalid_request",
      diagnostics: {
        code: "unsupported_response_schema",
        message: 'response schema contains unsupported keyword "const"',
      },
    });
  });

  it("does not call Gemini when the key is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(
      invokeStructured({
        node: "build_cases",
        system: "system",
        user: "user",
        schema,
        remainingMs: () => 20_000,
      }),
    ).rejects.toMatchObject({
      category: "authentication",
      message: "authentication",
      diagnostics: { code: "missing_api_key", message: "GEMINI_API_KEY is not set" },
    });
  });

  it("reports a missing key from the smoke helper without calling Gemini", async () => {
    delete process.env.GEMINI_API_KEY;
    const report = await runGeminiSmoke();
    expect(report.success).toBe(false);
    expect(report.category).toBe("authentication");
    expect(report.code).toBe("missing_api_key");
    expect(report.message).toBe("GEMINI_API_KEY is not set");
    expect(report).not.toHaveProperty("ok");
  });

  it("retries malformed output once and then returns the valid object", async () => {
    let calls = 0;
    const result = await invokeStructured({
      node: "build_cases",
      system: "system",
      user: "user",
      schema,
      remainingMs: () => 20_000,
      generate: async () => {
        calls += 1;
        return calls === 1 ? {} : { ok: true };
      },
    });

    expect(calls).toBe(2);
    expect(result).toEqual({ ok: true });
  });

  it("does not retry a deterministic invalid request", async () => {
    let calls = 0;
    await expect(
      invokeStructured({
        node: "build_cases",
        system: "system",
        user: "user",
        schema,
        remainingMs: () => 20_000,
        generate: async () => {
          calls += 1;
          throw {
            status: 400,
            code: "INVALID_ARGUMENT",
            message: "bad request https://example.test?key=AIzaSyABCDEFGHIJKLMNOP",
          };
        },
      }),
    ).rejects.toMatchObject({
      category: "invalid_request",
      message: "invalid_request",
      diagnostics: {
        status: 400,
        code: "INVALID_ARGUMENT",
        message: "bad request [url]",
      },
    });
    expect(calls).toBe(1);
  });

  it("does not retry an authentication failure", async () => {
    let calls = 0;
    await expect(
      invokeStructured({
        node: "build_cases",
        system: "system",
        user: "user",
        schema,
        remainingMs: () => 20_000,
        generate: async () => {
          calls += 1;
          throw { status: 401, message: "API key not valid" };
        },
      }),
    ).rejects.toMatchObject({
      category: "authentication",
      message: "authentication",
      diagnostics: { status: 401 },
    });
    expect(calls).toBe(1);
  });

  it("does not retry when the model is not found", async () => {
    let calls = 0;
    await expect(
      invokeStructured({
        node: "build_cases",
        system: "system",
        user: "user",
        schema,
        remainingMs: () => 20_000,
        generate: async () => {
          calls += 1;
          throw { status: 404, message: "model gemini-2.5-flash is not found" };
        },
      }),
    ).rejects.toMatchObject({ category: "model_not_found", message: "model_not_found" });
    expect(calls).toBe(1);
  });

  it("retries provider unavailability once", async () => {
    let calls = 0;
    await expect(
      invokeStructured({
        node: "build_cases",
        system: "system",
        user: "user",
        schema,
        remainingMs: () => 20_000,
        generate: async () => {
          calls += 1;
          throw { status: 503, message: "unavailable" };
        },
      }),
    ).rejects.toMatchObject({ category: "unavailable", diagnostics: { status: 503 } });
    expect(calls).toBe(2);
  });

  it("returns invalid_output when structured output stays malformed", async () => {
    let calls = 0;
    await expect(
      invokeStructured({
        node: "build_cases",
        system: "system",
        user: "user",
        schema,
        remainingMs: () => 20_000,
        generate: async () => {
          calls += 1;
          return { unexpected: true };
        },
      }),
    ).rejects.toMatchObject({ category: "invalid_output", message: "invalid_output" });
    expect(calls).toBe(2);
  });

  it("fails before a call when the remaining budget is too small", async () => {
    let calls = 0;
    await expect(
      invokeStructured({
        node: "produce_verdict",
        system: "system",
        user: "user",
        schema,
        remainingMs: () => 400,
        generate: async () => {
          calls += 1;
          return { ok: true };
        },
      }),
    ).rejects.toMatchObject({ category: "timeout" });
    expect(calls).toBe(0);
  });

  it("keeps model schemas free of null unions", () => {
    for (const modelSchema of [casesSchema, evaluationSchema, judgeSchema, repairSchema]) {
      const json = JSON.stringify(z.toJSONSchema(modelSchema));
      expect(json).not.toContain('"null"');
      expect(json).not.toContain('"anyOf"');
    }
  });
});

describe("generation metadata", () => {
  it("keeps finish reason and output tokens separate from response text", () => {
    const observation = readGenerationObservation({
      content: "SECRET_MODEL_TEXT",
      response_metadata: {
        finishReason: "MAX_TOKENS",
        safetyRatings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT" }],
      },
      usage_metadata: { output_tokens: 812, input_tokens: 400 },
    });
    expect(observation).toEqual({ finishReason: "MAX_TOKENS", outputTokens: 812 });
    expect(
      readGenerationObservation({
        additional_kwargs: { finishReason: "STOP" },
        usage_metadata: { output_tokens: 120 },
      }),
    ).toEqual({ finishReason: "STOP", outputTokens: 120 });
    expect(JSON.stringify(observation)).not.toContain("SECRET_MODEL_TEXT");
    expect(JSON.stringify(observation)).not.toContain("HARM");
  });

  it("logs finish reason in development without the response", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      vi.stubEnv("NODE_ENV", "development");
      logDevelopmentEvent("model_output_invalid", {
        node: "analysis",
        parseStage: "json_parse",
        finishReason: "MAX_TOKENS",
        outputTokens: 812,
        response: "SECRET_MODEL_TEXT",
      });
      const logged = JSON.parse(String(spy.mock.calls[0]?.[0]));
      expect(logged).toMatchObject({
        event: "model_output_invalid",
        node: "analysis",
        parseStage: "json_parse",
        finishReason: "MAX_TOKENS",
        outputTokens: 812,
      });
      expect(JSON.stringify(logged)).not.toContain("SECRET_MODEL_TEXT");
    } finally {
      vi.unstubAllEnvs();
      spy.mockRestore();
    }
  });
});

describe("development diagnostics", () => {
  it("logs only safe provider metadata in development", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      vi.stubEnv("NODE_ENV", "development");
      logEvent("provider_failure", {
        category: "invalid_request",
        providerStatus: 400,
        providerCode: "INVALID_ARGUMENT",
        providerMessage: "rejected key=AIzaSyABCDEFGHIJKLMNOP",
        decision: "a private decision",
        prompt: "system prompt",
      });
      const logged = JSON.parse(String(spy.mock.calls[0]?.[0]));
      expect(logged).toMatchObject({
        event: "provider_failure",
        category: "invalid_request",
        providerStatus: 400,
        providerCode: "INVALID_ARGUMENT",
        providerMessage: "rejected [redacted]",
      });
      expect(logged.decision).toBeUndefined();
      expect(logged.prompt).toBeUndefined();

      vi.stubEnv("NODE_ENV", "production");
      logEvent("provider_failure", {
        category: "authentication",
        providerMessage: "GEMINI_API_KEY is not set",
      });
      const production = JSON.parse(String(spy.mock.calls[1]?.[0]));
      expect(production.category).toBe("authentication");
      expect(production.providerMessage).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
      spy.mockRestore();
    }
  });

  it("keeps model attempt logs free of the decision and the response", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      vi.stubEnv("NODE_ENV", "development");
      logEvent("model_attempt", {
        node: "build_cases",
        attempt: 2,
        durationMs: 20,
        category: "unavailable",
        requestedModel: "gemini-3.8-flash",
        usedModel: "gemini-3.8-flash",
        fallbackUsed: false,
        decision: "a private decision",
        prompt: "system prompt",
        response: '{"advocate":{}}',
      });
      const logged = JSON.parse(String(spy.mock.calls[0]?.[0]));
      expect(logged).toMatchObject({
        event: "model_attempt",
        node: "build_cases",
        attempt: 2,
        requestedModel: "gemini-3.8-flash",
        usedModel: "gemini-3.8-flash",
        fallbackUsed: false,
        category: "unavailable",
      });
      expect(logged.decision).toBeUndefined();
      expect(logged.prompt).toBeUndefined();
      expect(logged.response).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
      spy.mockRestore();
    }
  });
});

describe("availability fallback", () => {
  const primary = "gemini-3.8-flash";
  const fallback = "gemini-3.6-flash";
  const side = {
    summary: "A short case.",
    strongestArguments: ["One clear point.", "A second point.", "A third point."],
    assumptions: ["The stated goal holds.", "The stated constraint holds."],
    evidenceStrength: "mixed" as const,
  };
  const validCases = JSON.stringify({
    advocate: side,
    challenger: { ...side, evidenceStrength: "thin" },
  });

  function overload() {
    return Object.assign(new Error("This model is currently experiencing high demand"), {
      status: 503,
    });
  }

  function caller(generate: (model: string, attempt: number) => Promise<string> | string) {
    const models: string[] = [];
    const sleeps: number[] = [];
    let now = 0;
    let endsAt = 55_000;
    return {
      models,
      sleeps,
      at(ms: number) {
        now = ms;
      },
      budget(ms: number) {
        endsAt = ms;
      },
      run: () =>
        invokeText({
          node: "build_cases",
          system: "system",
          user: "user",
          remainingMs: () => endsAt - now,
          maxOutputTokens: 1_200,
          requestedModel: primary,
          fallbackModel: fallback,
          random: () => 0,
          sleep: async (ms) => {
            sleeps.push(ms);
            now += ms;
          },
          generate: async (input) => {
            models.push(input.model);
            return generate(input.model, input.attempt);
          },
        }),
    };
  }

  it("does not call the fallback when the primary model succeeds", async () => {
    const run = caller(async () => validCases);
    const result = await run.run();
    expect(run.models).toEqual([primary]);
    expect(run.sleeps).toEqual([]);
    expect(result).toMatchObject({
      requestedModel: primary,
      usedModel: primary,
      fallbackUsed: false,
      attempt: 1,
    });
    expect(parseModelJson(result.text, casesSchema).ok).toBe(true);
  });

  it("retries the primary model once after a transient 503", async () => {
    const run = caller(async (_model, attempt) => {
      if (attempt === 1) throw overload();
      return validCases;
    });
    const result = await run.run();
    expect(run.models).toEqual([primary, primary]);
    expect(run.sleeps).toEqual([primaryRetryDelayMs(() => 0)]);
    expect(result).toMatchObject({ usedModel: primary, fallbackUsed: false, attempt: 2 });
  });

  it("uses the fallback model after two primary 503 responses", async () => {
    const run = caller(async (model) => {
      if (model === primary) throw overload();
      return validCases;
    });
    const result = await run.run();
    expect(run.models).toEqual([primary, primary, fallback]);
    expect(result).toMatchObject({
      requestedModel: primary,
      usedModel: fallback,
      fallbackUsed: true,
      attempt: 3,
    });
    expect(parseModelJson(result.text, casesSchema).ok).toBe(true);
  });

  it("returns unavailable when the fallback model is also overloaded", async () => {
    const run = caller(async () => {
      throw overload();
    });
    await expect(run.run()).rejects.toMatchObject({
      category: "unavailable",
      attemptInfo: { requestedModel: primary, usedModel: fallback, fallbackUsed: true, attempt: 3 },
    });
    expect(run.models).toEqual([primary, primary, fallback]);
  });

  it("does not retry an authentication failure", async () => {
    const run = caller(async () => {
      throw Object.assign(new Error("API key not valid"), { status: 401 });
    });
    await expect(run.run()).rejects.toMatchObject({ category: "authentication" });
    expect(run.models).toEqual([primary]);
    expect(run.sleeps).toEqual([]);
  });

  it("does not retry a rate limit or an unknown model", async () => {
    const limited = caller(async () => {
      throw Object.assign(new Error("quota exceeded"), { status: 429 });
    });
    await expect(limited.run()).rejects.toMatchObject({ category: "rate_limit" });
    expect(limited.models).toEqual([primary]);

    const missing = caller(async () => {
      throw Object.assign(new Error("model gemini-3.8-flash is not found"), { status: 404 });
    });
    await expect(missing.run()).rejects.toMatchObject({ category: "model_not_found" });
    expect(missing.models).toEqual([primary]);
  });

  it("does not retry a timeout", async () => {
    const run = caller(async () => {
      throw Object.assign(new Error("This operation was aborted"), { name: "AbortError" });
    });
    await expect(run.run()).rejects.toMatchObject({ category: "timeout" });
    expect(run.models).toEqual([primary]);
    expect(run.sleeps).toEqual([]);
  });

  it("does not retry an invalid request", async () => {
    const run = caller(async () => {
      throw Object.assign(new Error("Request contains an invalid argument."), {
        status: 400,
        code: "INVALID_ARGUMENT",
      });
    });
    await expect(run.run()).rejects.toMatchObject({ category: "invalid_request" });
    expect(run.models).toEqual([primary]);
    expect(run.sleeps).toEqual([]);
  });

  it("returns malformed JSON without switching models", async () => {
    const run = caller(async () => "{");
    const result = await run.run();
    expect(run.models).toEqual([primary]);
    expect(result.fallbackUsed).toBe(false);
    expect(parseModelJson(result.text, casesSchema)).toMatchObject({
      ok: false,
      parseSuccess: false,
    });
  });

  it("does not start a retry when the deadline is nearly gone", async () => {
    const run = caller(async () => {
      run.at(600);
      throw overload();
    });
    run.budget(1_800);
    await expect(run.run()).rejects.toMatchObject({ category: "unavailable" });
    expect(run.models).toEqual([primary]);
    expect(run.sleeps).toEqual([]);
  });

  it("does not start the fallback when the deadline is nearly gone", async () => {
    const run = caller(async (_model, attempt) => {
      if (attempt === 2) run.at(19_200);
      throw overload();
    });
    run.budget(20_000);
    await expect(run.run()).rejects.toMatchObject({
      category: "unavailable",
      attemptInfo: { usedModel: primary, fallbackUsed: false, attempt: 2 },
    });
    expect(run.models).toEqual([primary, primary]);
  });

  it("keeps the raw request path off structured output", () => {
    const source = readFileSync(path.join(process.cwd(), "src/lib/ai/gemini.ts"), "utf8");
    const start = source.indexOf("async function requestRawText");
    const end = source.indexOf("function sleep");
    const raw = source.slice(start, end);
    expect(raw).toContain(".invoke(");
    expect(raw).toContain("{ signal: controller.signal }");
    expect(raw).toContain("withHardDeadline");
    expect(raw).not.toContain("withStructuredOutput");
    expect(raw).not.toContain("responseSchema");
  });

  it("gives the second attempt only the time still left", async () => {
    let now = 0;
    const endsAt = CASES_DIAGNOSTIC_TIMEOUT_MS;
    const timeouts: number[] = [];
    const result = await invokeText({
      node: "build_cases",
      system: "system",
      user: "user",
      remainingMs: () => endsAt - now,
      maxOutputTokens: 1_200,
      requestedModel: primary,
      fallbackModel: fallback,
      random: () => 0,
      sleep: async (ms) => {
        now += ms;
      },
      generate: async (input) => {
        timeouts.push(input.timeoutMs);
        if (input.attempt === 1) {
          now += 1_000;
          throw overload();
        }
        return validCases;
      },
    });
    expect(timeouts).toEqual([
      CASES_DIAGNOSTIC_TIMEOUT_MS,
      CASES_DIAGNOSTIC_TIMEOUT_MS - 1_000 - primaryRetryDelayMs(() => 0),
    ]);
    expect(result.fallbackUsed).toBe(false);
    expect(result.attempt).toBe(2);
  });
});

describe("hard deadline", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the provider result when it arrives before the deadline", async () => {
    vi.useFakeTimers();
    const result = await withHardDeadline(Promise.resolve("ready"), 45_000, {
      node: "build_cases",
    });
    expect(result).toBe("ready");
    await vi.advanceTimersByTimeAsync(45_000);
    expect(result).toBe("ready");
  });

  it("rejects at the deadline and ignores a later provider success", async () => {
    vi.useFakeTimers();
    let resolveLate: (value: string) => void = () => {};
    const provider = new Promise<string>((resolve) => {
      resolveLate = resolve;
    });
    const abort = vi.fn();
    const raced = withHardDeadline(provider, 45_000, { abort, node: "build_cases" });
    const expectation = expect(raced).rejects.toMatchObject({
      category: "timeout",
      node: "build_cases",
    });
    await vi.advanceTimersByTimeAsync(45_000);
    expect(abort).toHaveBeenCalledOnce();
    resolveLate("late json");
    await expectation;
  });

  it("absorbs a late provider rejection", async () => {
    vi.useFakeTimers();
    const unhandled: unknown[] = [];
    const onUnhandled = (error: unknown) => {
      unhandled.push(error);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      let rejectLate: (error: Error) => void = () => {};
      const provider = new Promise<string>((_, reject) => {
        rejectLate = reject;
      });
      const raced = withHardDeadline(provider, 1_000, { node: "build_cases" });
      const expectation = expect(raced).rejects.toMatchObject({ category: "timeout" });
      await vi.advanceTimersByTimeAsync(1_000);
      rejectLate(new Error("late failure"));
      await expectation;
      await Promise.resolve();
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("does not retry or fall back when the primary call is still pending at the deadline", async () => {
    vi.useFakeTimers();
    const models: string[] = [];
    const pending = invokeText({
      node: "build_cases",
      system: "system",
      user: "user",
      remainingMs: () => 45_000,
      maxOutputTokens: 1_200,
      requestedModel: "gemini-3.8-flash",
      fallbackModel: "gemini-3.6-flash",
      sleep: () => new Promise(() => {}),
      generate: (input) => {
        models.push(`${input.model}:${input.timeoutMs}`);
        return new Promise(() => {});
      },
    });
    const expectation = expect(pending).rejects.toMatchObject({
      category: "timeout",
      node: "build_cases",
      attemptInfo: { usedModel: "gemini-3.8-flash", fallbackUsed: false, attempt: 1 },
    });
    await vi.advanceTimersByTimeAsync(45_000);
    await expectation;
    expect(models).toEqual(["gemini-3.8-flash:45000"]);
  });

  it("keeps the app on one 40 second budget", () => {
    expect(CASES_DIAGNOSTIC_TIMEOUT_MS).toBe(45_000);
    expect(OVERALL_BUDGET_MS).toBe(40_000);
    const analyze = readFileSync(path.join(process.cwd(), "src/lib/agents/analyze.ts"), "utf8");
    expect(analyze).toContain("OVERALL_BUDGET_MS");
    expect(analyze).toContain("ANALYSIS_MAX_OUTPUT_TOKENS");
    expect(analyze).not.toContain("singleAttempt");
    expect(analyze).not.toContain("runDecisionAnalysis");
  });
});
