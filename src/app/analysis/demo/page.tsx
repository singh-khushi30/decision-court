import type { Metadata } from "next";
import { AnalysisExperience } from "@/components/analysis/analysis-experience";

export const metadata: Metadata = {
  title: "Analysis demo",
  description:
    "A prepared preview of the Advocate and Challenger building opposing cases.",
};

export default function AnalysisDemoPage() {
  return <AnalysisExperience />;
}
