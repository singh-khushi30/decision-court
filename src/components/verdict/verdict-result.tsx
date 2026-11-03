"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { VerdictExperience } from "@/components/verdict/verdict-experience";
import { useAnalysisResult } from "@/lib/use-analysis-result";
import { useIsClient } from "@/lib/use-decision-draft";

export function VerdictResult() {
  const ready = useIsClient();
  const analysis = useAnalysisResult();

  if (!ready) {
    return (
      <main id="content" className="px-6 py-16 text-sm text-taupe">
        Opening the verdict…
      </main>
    );
  }

  if (!analysis) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="mx-auto flex w-full max-w-3xl items-center px-5 py-5 sm:px-8">
          <Logo />
        </header>
        <main id="content" className="mx-auto w-full max-w-3xl px-5 pt-8 pb-16 sm:px-8">
          <h1 className="font-serif text-4xl font-medium text-ink">No analysis is saved in this tab.</h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-espresso/75">
            A finished review stays in this browser tab until the session ends. Start again when you are ready.
          </p>
          <Link
            href="/decide"
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-parchment"
          >
            Start a decision
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </main>
      </div>
    );
  }

  return <VerdictExperience analysis={analysis} source="result" />;
}
