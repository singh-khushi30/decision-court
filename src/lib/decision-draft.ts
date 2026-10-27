import { z } from "zod";

export const DECISION_LIMIT = 800;
export const CONTEXT_LIMIT = 400;

const contextField = z
  .string()
  .trim()
  .max(CONTEXT_LIMIT, `Keep this under ${CONTEXT_LIMIT} characters.`);

export const decisionDraftSchema = z.object({
  decision: z
    .string()
    .trim()
    .min(1, "Describe the decision you want to examine.")
    .max(DECISION_LIMIT, `Keep the decision under ${DECISION_LIMIT} characters.`),
  situation: contextField,
  goals: contextField,
  constraints: contextField,
  timeline: contextField,
});

export type DecisionDraft = z.infer<typeof decisionDraftSchema>;
export type DecisionStep = 1 | 2 | 3;

export const emptyDecisionDraft: DecisionDraft = {
  decision: "",
  situation: "",
  goals: "",
  constraints: "",
  timeline: "",
};

const STORAGE_KEY = "decision-court.draft";
const DRAFT_EVENT = "decision-court-draft";

let cachedRaw: string | null | undefined;
let cachedSnapshot: StoredDecisionDraft | null = null;

const storedSchema = z.object({
  draft: z.object({
    decision: z.string(),
    situation: z.string(),
    goals: z.string(),
    constraints: z.string(),
    timeline: z.string(),
  }),
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export type StoredDecisionDraft = z.infer<typeof storedSchema>;

function parseStoredDraft(raw: string | null): StoredDecisionDraft | null {
  if (!raw) return null;

  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function readDecisionDraft(): StoredDecisionDraft | null {
  if (typeof window === "undefined") return null;
  return parseStoredDraft(window.sessionStorage.getItem(STORAGE_KEY));
}

export function getDecisionDraftSnapshot(): StoredDecisionDraft | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;

  cachedRaw = raw;
  cachedSnapshot = parseStoredDraft(raw);
  return cachedSnapshot;
}

export function subscribeToDecisionDraft(onStoreChange: () => void) {
  window.addEventListener(DRAFT_EVENT, onStoreChange);
  return () => window.removeEventListener(DRAFT_EVENT, onStoreChange);
}

export function writeDecisionDraft(draft: DecisionDraft, step: DecisionStep) {
  if (typeof window === "undefined") return;
  const payload: StoredDecisionDraft = { draft, step };
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event(DRAFT_EVENT));
}
