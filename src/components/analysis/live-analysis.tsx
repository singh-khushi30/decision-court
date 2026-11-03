"use client";

import { ArrowRight, Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AgentPortrait } from "@/components/analysis/agent-portrait";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { analysisStages } from "@/lib/demo/decision";
import { writeAnalysisResult } from "@/lib/analysis-result";
import type { DecisionDraft } from "@/lib/decision-draft";
import { requestAnalysis } from "@/lib/request-analysis";
import { DECISION_MIN } from "@/lib/schemas/limits";
import { useDecisionDraft, useIsClient } from "@/lib/use-decision-draft";
import { cn } from "@/lib/utils";

export function LiveAnalysis() {
  const ready = useIsClient();
  const stored = useDecisionDraft();

  if (!ready) {
    return (
      <main id="content" className="px-6 py-16 text-sm text-taupe">
        Opening the analysis…
      </main>
    );
  }

  const decision = stored?.draft.decision.trim() ?? "";
  if (decision.length < DECISION_MIN) {
    return (
      <AnalysisNotice
        title="Add a decision first."
        body="The review needs the decision you want examined."
      />
    );
  }

  return <RunningAnalysis draft={stored?.draft ?? emptyDraft(decision)} />;
}

function emptyDraft(decision: string): DecisionDraft {
  return { decision, situation: "", goals: "", constraints: "", timeline: "" };
}

function RunningAnalysis({ draft }: { draft: DecisionDraft }) {
  const reduced = useReducedMotion();
  const router = useRouter();
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reduced !== false || paused || error || stage >= analysisStages.length - 1) return;
    const id = window.setInterval(() => {
      setStage((current) => Math.min(current + 1, analysisStages.length - 1));
    }, 4000);
    return () => window.clearInterval(id);
  }, [error, paused, reduced, stage]);

  useEffect(() => {
    let cancelled = false;
    const task = requestAnalysis({
      decision: draft.decision,
      context: {
        currentSituation: draft.situation,
        goals: draft.goals,
        constraints: draft.constraints,
        timeline: draft.timeline,
      },
    });

    task.then((result) => {
      if (cancelled) return;
      if (result.ok) {
        writeAnalysisResult(result.analysis);
        router.push("/verdict/result");
        return;
      }
      setError(result.message);
    });

    return () => {
      cancelled = true;
    };
  }, [draft, router]);

  const current = analysisStages[stage];

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-5 sm:px-8">
        <Logo />
        <p className="text-sm text-espresso/80" aria-live="polite">
          <span className="font-medium text-ink">
            Your Advocate and Challenger are examining the decision...
          </span>
        </p>
        <div className="ml-auto flex items-center gap-3">
          {reduced || error ? null : (
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-full border-sand bg-cream px-4"
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? "Resume" : "Stop"}
            </Button>
          )}
          <span className="text-xs tabular-nums text-taupe">
            {stage + 1}/{analysisStages.length}
          </span>
        </div>
        <div className="h-px w-full bg-sand" aria-hidden="true">
          <div
            className="h-px bg-brass transition-[width] duration-500"
            style={{ width: `${((stage + 1) / analysisStages.length) * 100}%` }}
          />
        </div>
      </header>

      <main
        id="content"
        className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-5 pt-6 pb-16 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12"
      >
        <ol aria-label="Analysis stages" className="flex gap-4 overflow-x-auto lg:flex-col lg:overflow-visible">
          {analysisStages.map((item, index) => {
            const complete = index < stage;
            const active = index === stage;
            return (
              <li key={item.id} className="flex min-w-fit items-start gap-3 lg:min-w-0">
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    complete && "border-sage bg-sage text-parchment",
                    active && "border-ink bg-ink",
                    !complete && !active && "border-sand bg-cream",
                  )}
                  aria-hidden="true"
                >
                  {complete ? <Check className="size-3" /> : null}
                  {active ? <span className="size-1.5 rounded-full bg-parchment" /> : null}
                </span>
                <span className={cn("text-sm", active ? "font-medium text-ink" : "text-taupe")}>
                  {item.label}
                  {active ? <span className="sr-only">, shown stage</span> : null}
                </span>
              </li>
            );
          })}
        </ol>

        <div>
          <p className="font-serif text-3xl font-medium text-ink sm:text-4xl">
            {error ? "The analysis stopped" : current?.label}
          </p>
          <p className="mt-3 max-w-2xl text-base leading-7 text-espresso/75">{draft.decision}</p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-taupe">
            These stages show the shape of the review. They are not a live transcript of the model.
          </p>

          {error ? (
            <div className="mt-8 max-w-xl rounded-[1.5rem] border border-sand bg-cream px-5 py-5" role="alert">
              <p className="text-base leading-7 text-espresso">{error}</p>
              <Link
                href="/decide"
                className="mt-4 inline-flex text-sm text-espresso underline decoration-sand underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
              >
                Back to your decision
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {(
                [
                  {
                    id: "advocate" as const,
                    eyebrow: "The Advocate",
                    title: "The case for",
                    line: "Building the strongest reasonable case from what you supplied.",
                  },
                  {
                    id: "challenger" as const,
                    eyebrow: "The Challenger",
                    title: "The case against",
                    line: "Stress-testing assumptions, costs, and downside.",
                  },
                ] as const
              ).map((agent, index) => (
                <motion.article
                  key={agent.id}
                  initial={reduced ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: reduced ? 0 : index * 0.08 }}
                  className="overflow-hidden rounded-[1.5rem] border border-sand bg-cream shadow-[0_24px_50px_-40px_rgba(60,40,20,0.55)]"
                >
                  <AgentPortrait role={agent.id} />
                  <div className="px-5 py-5">
                    <h2 className="text-xs tracking-[0.16em] text-taupe uppercase">{agent.eyebrow}</h2>
                    <p className="mt-2 font-serif text-2xl font-medium text-ink">{agent.title}</p>
                    <p className="mt-4 text-sm leading-6 text-espresso/80">{agent.line}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function AnalysisNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center px-5 py-5 sm:px-8">
        <Logo />
      </header>
      <main id="content" className="mx-auto w-full max-w-3xl px-5 pt-8 pb-16 sm:px-8">
        <h1 className="font-serif text-4xl font-medium text-ink">{title}</h1>
        <p className="mt-4 max-w-lg text-base leading-7 text-espresso/75">{body}</p>
        <Link
          href="/decide"
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-parchment"
        >
          Describe a decision
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </main>
    </div>
  );
}
