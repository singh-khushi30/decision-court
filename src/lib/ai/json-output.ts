import { z } from "zod";

const FENCE = /^```(?:json)?[ \t]*\r?\n?([\s\S]*?)\r?\n?```$/i;
const SOURCE_LIMIT = 2_000;
const PROBLEM_LIMIT = 8;

export type SafeOutputIssue = {
  path: string;
  code: string;
  expected?: string;
  received?: string;
  bound?: number;
};

export type OutputDiagnostic =
  | {
      parseStage: "json_parse";
      responseLength: number;
      fenced: boolean;
      first?: string;
      last?: string;
    }
  | {
      parseStage: "zod_validation";
      issues: SafeOutputIssue[];
    };

export type ParsedModelJson<T> = {
  ok: true;
  data: T;
  parseSuccess: true;
  validationSuccess: true;
  source: string;
} | {
  ok: false;
  parseSuccess: boolean;
  validationSuccess: false;
  problems: string[];
  source: string;
  diagnostic: OutputDiagnostic;
};

export function extractJsonText(raw: string): string | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(FENCE);
  const body = (fenced ? fenced[1] : trimmed).trim();
  if (!body.startsWith("{") && !body.startsWith("[")) return null;
  return body;
}

function compactIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, PROBLEM_LIMIT).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "value";
    const message = issue.message.replace(/\s+/g, " ").slice(0, 120);
    return `${path}: ${message}`;
  });
}

function boundSource(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, SOURCE_LIMIT);
}

const ISSUE_LIMIT = 8;
const TOKEN = /^[A-Za-z0-9_.]+$/;
const RECEIVED = new Set([
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "null",
  "undefined",
  "unknown",
]);

export function jsonParseDiagnostic(raw: string): OutputDiagnostic {
  const trimmed = raw.trim();
  const diagnostic: OutputDiagnostic = {
    parseStage: "json_parse",
    responseLength: raw.length,
    fenced: trimmed.startsWith("```"),
  };
  if (trimmed.length > 0) {
    return { ...diagnostic, first: trimmed[0], last: trimmed[trimmed.length - 1] };
  }
  return diagnostic;
}

function token(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80 || !TOKEN.test(trimmed)) return undefined;
  return trimmed;
}

function receivedType(input: unknown): string {
  if (input === null) return "null";
  if (Array.isArray(input)) return "array";
  const kind = typeof input;
  if (kind === "string" || kind === "number" || kind === "boolean" || kind === "undefined") return kind;
  if (kind === "object") return "object";
  return "unknown";
}

function receivedCategory(record: Record<string, unknown>, code: string): string | undefined {
  if (code === "invalid_type" && typeof record.message === "string") {
    const match = record.message.match(/^Invalid input: expected [a-z]+, received ([a-z]+)$/);
    if (match?.[1] && RECEIVED.has(match[1])) return match[1];
  }
  if ((code === "too_big" || code === "too_small") && typeof record.origin === "string" && RECEIVED.has(record.origin)) {
    return record.origin;
  }
  if ("input" in record && record.input !== undefined) {
    const kind = receivedType(record.input);
    if (RECEIVED.has(kind)) return kind;
  }
  return undefined;
}

function boundFor(code: string, record: Record<string, unknown>): number | undefined {
  const value = code === "too_big" ? record.maximum : code === "too_small" ? record.minimum : undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 10_000) return undefined;
  return value;
}

export function safeOutputIssue(issue: unknown): SafeOutputIssue {
  if (!issue || typeof issue !== "object") return { path: "value", code: "custom" };
  const record = issue as Record<string, unknown>;
  const path = Array.isArray(record.path)
    ? record.path
        .map((part) => (typeof part === "number" && Number.isInteger(part) && part >= 0 ? String(part) : token(part)))
        .filter((part): part is string => Boolean(part))
        .join(".")
    : "";
  const code = token(record.code) ?? "custom";
  const safe: SafeOutputIssue = { path: path || "value", code };
  const expected =
    code === "invalid_value"
      ? "enum"
      : token(code === "invalid_type" ? record.expected : record.origin);
  const received = receivedCategory(record, code);
  if (expected) safe.expected = expected;
  if (received) safe.received = received;
  const bound = boundFor(code, record);
  if (bound !== undefined) safe.bound = bound;
  return safe;
}

function zodDiagnostic(error: z.ZodError): OutputDiagnostic {
  return {
    parseStage: "zod_validation",
    issues: error.issues.slice(0, ISSUE_LIMIT).map((issue) => safeOutputIssue(issue)),
  };
}

export function parseModelJson<T>(raw: unknown, schema: z.ZodType<T>): ParsedModelJson<T> {
  if (typeof raw === "string") {
    const extracted = extractJsonText(raw);
    if (!extracted) {
      return {
        ok: false,
        parseSuccess: false,
        validationSuccess: false,
        problems: ["The response was not a JSON object."],
        source: boundSource(raw),
        diagnostic: jsonParseDiagnostic(raw),
      };
    }
    try {
      return validateJsonValue(JSON.parse(extracted), schema, boundSource(raw));
    } catch {
      return {
        ok: false,
        parseSuccess: false,
        validationSuccess: false,
        problems: ["The response was not valid JSON."],
        source: boundSource(raw),
        diagnostic: jsonParseDiagnostic(raw),
      };
    }
  }

  if (raw && typeof raw === "object") {
    return validateJsonValue(raw, schema, boundSource(JSON.stringify(raw)));
  }

  return {
    ok: false,
    parseSuccess: false,
    validationSuccess: false,
    problems: ["The model response was not JSON text."],
    source: "",
    diagnostic: { parseStage: "json_parse", responseLength: 0, fenced: false },
  };
}

function validateJsonValue<T>(
  value: unknown,
  schema: z.ZodType<T>,
  source: string,
): ParsedModelJson<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      parseSuccess: true,
      validationSuccess: false,
      problems: compactIssues(parsed.error),
      source,
      diagnostic: zodDiagnostic(parsed.error),
    };
  }
  return {
    ok: true,
    data: parsed.data,
    parseSuccess: true,
    validationSuccess: true,
    source,
  };
}
