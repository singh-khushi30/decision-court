export const providerCategories = [
  "timeout",
  "rate_limit",
  "authentication",
  "invalid_request",
  "model_not_found",
  "empty_output",
  "unavailable",
  "invalid_output",
  "generic",
] as const;

export type ProviderCategory = (typeof providerCategories)[number];

export type ProviderDiagnostics = {
  status?: number;
  code?: string;
  message?: string;
};

export type ModelAttempt = {
  requestedModel: string;
  usedModel: string;
  fallbackUsed: boolean;
  attempt: number;
};

export class AnalysisError extends Error {
  readonly category: ProviderCategory;
  readonly node?: string;
  readonly diagnostics?: ProviderDiagnostics;
  readonly attemptInfo?: ModelAttempt;

  constructor(
    category: ProviderCategory,
    node?: string,
    diagnostics?: ProviderDiagnostics,
    attemptInfo?: ModelAttempt,
  ) {
    super(category);
    this.name = "AnalysisError";
    this.category = category;
    this.node = node;
    this.diagnostics = diagnostics;
    this.attemptInfo = attemptInfo;
  }
}

export type AnalysisFailure = {
  category: ProviderCategory;
  node?: string;
  providerStatus?: number;
  providerCode?: string;
  providerMessage?: string;
};

const MESSAGE_LIMIT = 180;

export function sanitizeProviderMessage(value: string): string {
  const compact = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  const withoutJson = compact.split("{")[0]?.trim() ?? "";
  return withoutJson
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b(?:key|api[_-]?key|token|authorization)\s*[:=]\s*\S+/gi, "[redacted]")
    .replace(/\bBearer\s+\S+/gi, "[redacted]")
    .replace(/\bAIza[0-9A-Za-z_-]{8,}\b/g, "[redacted]")
    .replace(/\bsk-[A-Za-z0-9]{8,}\b/g, "[redacted]")
    .slice(0, MESSAGE_LIMIT)
    .trim();
}

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const record = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
    error?: { code?: unknown };
  };
  const candidates = [record.status, record.statusCode, record.response?.status, record.error?.code];
  for (const candidate of candidates) {
    if (typeof candidate === "number") return candidate;
  }
  return undefined;
}

function readCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const record = error as {
    code?: unknown;
    status?: unknown;
    error?: { status?: unknown; code?: unknown };
  };
  const candidates = [record.code, record.error?.status, record.error?.code, record.status];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && !/^\d+$/.test(candidate)) return candidate;
  }
  return "";
}

function readMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const record = error as { message?: unknown; error?: { message?: unknown } };
  if (typeof record.message === "string") return record.message;
  if (typeof record.error?.message === "string") return record.error.message;
  return "";
}

export function readProviderDiagnostics(error: unknown): ProviderDiagnostics | undefined {
  const status = readStatus(error);
  const code = readCode(error);
  const message = sanitizeProviderMessage(readMessage(error));
  if (status === undefined && !code && !message) return undefined;
  return {
    ...(status !== undefined ? { status } : {}),
    ...(code ? { code } : {}),
    ...(message ? { message } : {}),
  };
}

export function providerLogFields(
  diagnostics?: ProviderDiagnostics,
): Record<string, string | number | undefined> {
  return {
    providerStatus: diagnostics?.status,
    providerCode: diagnostics?.code,
    providerMessage: diagnostics?.message,
  };
}

function isAuthentication(code: string, message: string): boolean {
  if (code === "PERMISSION_DENIED" || code === "UNAUTHENTICATED") return true;
  return /API key|permission denied|unauthenticated/i.test(message);
}

function isModelMissing(code: string, message: string): boolean {
  if (code === "NOT_FOUND") return true;
  return /model .+ not found|is not found/i.test(message);
}

export function classifyProviderError(error: unknown): ProviderCategory {
  if (error instanceof AnalysisError) return error.category;

  const name =
    error instanceof Error
      ? error.name
      : error && typeof error === "object" && typeof (error as { name?: unknown }).name === "string"
        ? (error as { name: string }).name
        : "";
  if (name === "AbortError" || name === "TimeoutError") return "timeout";

  const status = readStatus(error);
  const code = readCode(error);
  const message = readMessage(error);

  if (status === 429 || code === "RESOURCE_EXHAUSTED") return "rate_limit";
  if (status === 401 || status === 403) return "authentication";
  if (status === 404 || (status === undefined && isModelMissing(code, message))) return "model_not_found";
  if (status === 408 || status === 504 || code === "DEADLINE_EXCEEDED") return "timeout";
  if (status !== undefined && status >= 500) return "unavailable";
  if (code === "UNAVAILABLE" || code === "INTERNAL") return "unavailable";
  if (status === 400 || code === "INVALID_ARGUMENT") {
    if (isAuthentication(code, message)) return "authentication";
    if (isModelMissing(code, message)) return "model_not_found";
    return "invalid_request";
  }
  if (isAuthentication(code, message)) return "authentication";

  if (name === "OutputParserException" || name === "ZodError") return "invalid_output";

  if (/invalid argument/i.test(message)) return "invalid_request";
  if (/quota|rate limit/i.test(message)) return "rate_limit";
  if (/timeout|timed out|deadline/i.test(message)) return "timeout";
  if (/high demand|overloaded|temporarily unavailable/i.test(message)) return "unavailable";
  if (/empty .*content|no output/i.test(message)) return "empty_output";
  if (/parse|schema|structured output/i.test(message)) return "invalid_output";

  return "generic";
}

export function toAnalysisFailure(node: string, error: unknown): AnalysisFailure {
  const category = error instanceof AnalysisError ? error.category : "generic";
  const diagnostics = error instanceof AnalysisError ? error.diagnostics : undefined;
  const failure: AnalysisFailure = { category, node };
  if (diagnostics?.status !== undefined) failure.providerStatus = diagnostics.status;
  if (diagnostics?.code) failure.providerCode = diagnostics.code;
  if (diagnostics?.message) failure.providerMessage = diagnostics.message;
  return failure;
}

export function shouldRetry(
  category: ProviderCategory,
  attempt: number,
  remainingMs: number,
): boolean {
  if (attempt >= 2) return false;
  if (remainingMs < 8_000) return false;
  return (
    category === "unavailable" ||
    category === "invalid_output" ||
    category === "empty_output"
  );
}
