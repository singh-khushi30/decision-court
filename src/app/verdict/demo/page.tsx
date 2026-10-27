import type { Metadata } from "next";
import { VerdictExperience } from "@/components/verdict/verdict-experience";

export const metadata: Metadata = {
  title: "Verdict demo",
  description:
    "A prepared Decision Court verdict with the case for, the case against, and what would change it.",
};

export default function VerdictDemoPage() {
  return <VerdictExperience />;
}
