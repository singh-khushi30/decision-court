import type { Metadata } from "next";
import { VerdictResult } from "@/components/verdict/verdict-result";

export const metadata: Metadata = {
  title: "Verdict",
  description: "A balanced reading of the decision you submitted.",
};

export default function VerdictResultPage() {
  return <VerdictResult />;
}
