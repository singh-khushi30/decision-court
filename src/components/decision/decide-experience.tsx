"use client";

import { useSearchParams } from "next/navigation";
import { DecisionFlow } from "@/components/decision/decision-flow";

export function DecideExperience() {
  const params = useSearchParams();
  return <DecisionFlow exampleId={params.get("example")} />;
}
