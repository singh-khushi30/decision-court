import { parseDecisionAnalysis } from "@/lib/schemas/decision-analysis";
import type { DecisionAnalysis } from "@/types/analysis";

const RESULT_KEY = "decision-court.result";
const RESULT_EVENT = "decision-court-result";

let cachedRaw: string | null | undefined;
let cachedSnapshot: DecisionAnalysis | null = null;

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(RESULT_KEY);
}

export function getAnalysisResultSnapshot(): DecisionAnalysis | null {
  if (typeof window === "undefined") return null;
  const raw = readRaw();
  if (raw === cachedRaw) return cachedSnapshot;

  cachedRaw = raw;
  if (!raw) {
    cachedSnapshot = null;
    return null;
  }

  try {
    cachedSnapshot = parseDecisionAnalysis(JSON.parse(raw));
  } catch {
    cachedSnapshot = null;
  }
  return cachedSnapshot;
}

export function subscribeToAnalysisResult(onStoreChange: () => void) {
  window.addEventListener(RESULT_EVENT, onStoreChange);
  return () => window.removeEventListener(RESULT_EVENT, onStoreChange);
}

export function writeAnalysisResult(analysis: DecisionAnalysis) {
  if (typeof window === "undefined") return;
  const parsed = parseDecisionAnalysis(analysis);
  if (!parsed) return;
  window.sessionStorage.setItem(RESULT_KEY, JSON.stringify(parsed));
  cachedRaw = undefined;
  window.dispatchEvent(new Event(RESULT_EVENT));
}

export function clearAnalysisResult() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(RESULT_KEY);
  cachedRaw = undefined;
  window.dispatchEvent(new Event(RESULT_EVENT));
}
