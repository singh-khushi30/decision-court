"use client";

import { useSyncExternalStore } from "react";
import {
  getAnalysisResultSnapshot,
  subscribeToAnalysisResult,
} from "@/lib/analysis-result";

export function useAnalysisResult() {
  return useSyncExternalStore(
    subscribeToAnalysisResult,
    getAnalysisResultSnapshot,
    () => null,
  );
}
