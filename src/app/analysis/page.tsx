import type { Metadata } from "next";
import { LiveAnalysis } from "@/components/analysis/live-analysis";

export const metadata: Metadata = {
  title: "Analysis",
  description: "The Advocate and Challenger examine the decision you described.",
  alternates: { canonical: "/analysis" },
};

export default function AnalysisPage() {
  return <LiveAnalysis />;
}
