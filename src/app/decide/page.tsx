import type { Metadata } from "next";
import { Suspense } from "react";
import { DecideExperience } from "@/components/decision/decide-experience";

export const metadata: Metadata = {
  title: "Your decision",
  description: "Describe a difficult decision and add the context around it.",
};

export default function DecidePage() {
  return (
    <Suspense
      fallback={
        <main id="content" className="px-6 py-16 text-sm text-taupe">
          Opening the decision form…
        </main>
      }
    >
      <DecideExperience />
    </Suspense>
  );
}
