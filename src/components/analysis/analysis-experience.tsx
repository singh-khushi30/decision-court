"use client";

import { ArrowRight, Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AgentPortrait } from "@/components/analysis/agent-portrait";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { analysisStages, demoAnalysis } from "@/lib/demo/decision";
import { useDecisionDraft } from "@/lib/use-decision-draft";
import { cn } from "@/lib/utils";

export function AnalysisExperience() {
  const reduced = useReducedMotion();
  const stored = useDecisionDraft();
  const question = stored?.draft.decision.trim() || demoAnalysis.decision;
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduced !== false || paused || stage >= analysisStages.length - 1) return;

    const id = window.setInterval(() => {
      setStage((current) => Math.min(current + 1, analysisStages.length - 1));
    }, 1200);

    return () => window.clearInterval(id);
  }, [paused, reduced, stage]);

  const current = analysisStages[stage];

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-5 sm:px-8">
        <Logo />
        <p className="text-sm text-espresso/80" aria-live="polite">
          <span className="font-medium text-ink">Analyzing your decision</span>
          <span className="text-taupe"> · prepared demo</span>
        </p>
        <div className="ml-auto flex items-center gap-3">
          {reduced ? null : (
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
        <div
          className="h-px w-full bg-sand"
          aria-hidden="true"
        >
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
                <span
                  className={cn(
                    "text-sm",
                    active ? "font-medium text-ink" : "text-taupe",
                  )}
                >
                  {item.label}
                  {active ? <span className="sr-only">, current stage</span> : null}
                </span>
              </li>
            );
          })}
        </ol>

        <div>
          <p className="font-serif text-3xl font-medium text-ink sm:text-4xl">
            {current?.label}
          </p>
          <p className="mt-3 max-w-2xl text-base leading-7 text-espresso/75">
            {question}
          </p>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {[demoAnalysis.advocateCase, demoAnalysis.challengerCase].map(
              (agent, index) => (
                <motion.article
                  key={agent.id}
                  initial={reduced ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: reduced ? 0 : index * 0.08 }}
                  className="overflow-hidden rounded-[1.5rem] border border-sand bg-cream shadow-[0_24px_50px_-40px_rgba(60,40,20,0.55)]"
                >
                  <AgentPortrait role={agent.id} />
                  <div className="px-5 py-5">
                    <h2 className="text-xs tracking-[0.16em] text-taupe uppercase">
                      {agent.eyebrow}
                    </h2>
                    <p className="mt-2 font-serif text-2xl font-medium text-ink">
                      {agent.title}
                    </p>
                    <ul className="mt-4 space-y-2">
                      {agent.activity.map((item) => (
                        <li key={item} className="flex gap-2 text-sm text-espresso/80">
                          <span
                            aria-hidden="true"
                            className={cn(
                              "mt-2 size-1.5 shrink-0 rounded-full",
                              agent.id === "advocate" ? "bg-sage" : "bg-terra",
                            )}
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.article>
              ),
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-md text-sm leading-6 text-taupe">
              This sequence is a preview of the court. The verdict is prepared demo content.
            </p>
            <Link
              href="/verdict/demo"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-parchment transition-colors hover:bg-espresso focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              View demo verdict
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
