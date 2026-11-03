import { messageForStatus } from "@/lib/ai/messages";
import { parseDecisionAnalysis } from "@/lib/schemas/decision-analysis";
import type { DecisionRequest } from "@/lib/schemas/decision-request";
import type { DecisionAnalysis } from "@/types/analysis";

export type AnalysisClientResult =
  | { ok: true; analysis: DecisionAnalysis }
  | { ok: false; message: string };

const pending = new Map<string, Promise<AnalysisClientResult>>();

function safeError(value: unknown, status: number): string {
  if (
    value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string" &&
    value.error.length > 0 &&
    value.error.length <= 240 &&
    !value.error.includes("\n")
  ) {
    return value.error;
  }
  return messageForStatus(status);
}

async function send(body: DecisionRequest): Promise<AnalysisClientResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 70_000);

  try {
    const response = await fetch("/api/decision/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      return { ok: false, message: safeError(payload, response.status) };
    }
    const analysis = parseDecisionAnalysis(payload);
    if (!analysis) {
      return { ok: false, message: messageForStatus(500) };
    }
    return { ok: true, analysis };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, message: messageForStatus(aborted ? 504 : 503) };
  } finally {
    clearTimeout(timer);
  }
}

export function requestAnalysis(body: DecisionRequest): Promise<AnalysisClientResult> {
  const key = JSON.stringify(body);
  const existing = pending.get(key);
  if (existing) return existing;

  const promise = send(body).finally(() => {
    if (pending.get(key) === promise) pending.delete(key);
  });
  pending.set(key, promise);
  return promise;
}

export function resetAnalysisRequestsForTests() {
  pending.clear();
}
