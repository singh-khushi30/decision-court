import { sanitizeProviderMessage } from "@/lib/ai/errors";

type LogField = string | number | boolean | undefined;

const allowed = new Set([
  "event",
  "node",
  "durationMs",
  "attempt",
  "category",
  "model",
  "status",
  "promptChars",
  "schemaChars",
  "maxOutputTokens",
  "timeoutMs",
  "parseSuccess",
  "validationSuccess",
  "requestedModel",
  "usedModel",
  "fallbackUsed",
]);

const developmentFields = new Set(["providerStatus", "providerCode", "providerMessage"]);

export function logEvent(event: string, fields: Record<string, LogField> = {}) {
  if (process.env.NODE_ENV === "test" || process.env.DECISION_COURT_SMOKE === "1") return;

  const development = process.env.NODE_ENV === "development";
  const entry: Record<string, LogField> = { event };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (developmentFields.has(key)) {
      if (!development) continue;
      if (key === "providerMessage" && typeof value === "string") {
        const sanitized = sanitizeProviderMessage(value);
        if (sanitized) entry[key] = sanitized;
        continue;
      }
      entry[key] = value;
      continue;
    }
    if (!allowed.has(key)) continue;
    entry[key] = value;
  }

  console.info(JSON.stringify(entry));
}

const parseStages = new Set(["json_parse", "zod_validation", "domain_check"]);
const issueTokens = /^[A-Za-z0-9_.]+$/;

function developmentToken(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80 || !issueTokens.test(trimmed)) return undefined;
  return trimmed;
}

function developmentIssue(value: unknown): Record<string, string | number> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const path = developmentToken(record.path);
  const code = developmentToken(record.code);
  if (!path || !code) return undefined;
  const issue: Record<string, string | number> = { path, code };
  const expected = developmentToken(record.expected);
  const received = developmentToken(record.received);
  if (expected) issue.expected = expected;
  if (received) issue.received = received;
  if (typeof record.bound === "number" && Number.isInteger(record.bound) && record.bound >= 0 && record.bound <= 10_000) {
    issue.bound = record.bound;
  }
  return issue;
}

export function logDevelopmentEvent(event: string, fields: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development" || process.env.DECISION_COURT_SMOKE === "1") return;
  const entry: Record<string, unknown> = { event: developmentToken(event) ?? "diagnostic" };
  const node = developmentToken(fields.node);
  if (node) entry.node = node;
  if (typeof fields.parseStage === "string" && parseStages.has(fields.parseStage)) {
    entry.parseStage = fields.parseStage;
  }
  if (typeof fields.responseLength === "number" && Number.isInteger(fields.responseLength) && fields.responseLength >= 0) {
    entry.responseLength = fields.responseLength;
  }
  if (typeof fields.fenced === "boolean") entry.fenced = fields.fenced;
  if (typeof fields.first === "string" && fields.first.length === 1) entry.first = fields.first;
  if (typeof fields.last === "string" && fields.last.length === 1) entry.last = fields.last;
  const finishReason = developmentToken(fields.finishReason);
  if (finishReason) entry.finishReason = finishReason;
  if (
    typeof fields.outputTokens === "number" &&
    Number.isInteger(fields.outputTokens) &&
    fields.outputTokens >= 0 &&
    fields.outputTokens <= 1_000_000
  ) {
    entry.outputTokens = fields.outputTokens;
  }
  if (Array.isArray(fields.issues)) {
    const issues = fields.issues.map(developmentIssue).filter((issue) => issue !== undefined).slice(0, 8);
    if (issues.length > 0) entry.issues = issues;
  }
  console.info(JSON.stringify(entry));
}
