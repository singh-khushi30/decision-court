"use client";

import { useSyncExternalStore } from "react";
import {
  getDecisionDraftSnapshot,
  subscribeToDecisionDraft,
} from "@/lib/decision-draft";

export function useDecisionDraft() {
  return useSyncExternalStore(
    subscribeToDecisionDraft,
    getDecisionDraftSnapshot,
    () => null,
  );
}

export function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
