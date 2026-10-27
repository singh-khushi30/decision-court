"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { ChangeFactors } from "@/components/verdict/change-factors";
import { demoAnalysis } from "@/lib/demo/decision";
import { useDecisionDraft } from "@/lib/use-decision-draft";
import { cn } from "@/lib/utils";

const sections = [
  { id: "verdict", label: "Verdict" },
  { id: "comparison", label: "For vs Against" },
  { id: "insights", label: "Key Insights" },
  { id: "change", label: "What Would Change It?" },
  { id: "actions", label: "Action Plan" },
  { id: "summary", label: "Summary" },
] as const;

export function VerdictExperience() {
  const analysis = demoAnalysis;
  const stored = useDecisionDraft();
  const question = stored?.draft.decision.trim() || analysis.decision;
  const draftNote = stored
    ? [
        stored.draft.situation,
        stored.draft.goals,
        stored.draft.constraints,
        stored.draft.timeline,
      ]
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const [active, setActive] = useState<string>(sections[0].id);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [confidenceOpen, setConfidenceOpen] = useState(false);
  const confidenceNoteId = useId();

  useEffect(() => {
    if (typeof IntersectionObserver !== "function") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.2, 0.5] },
    );

    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const differs = question.trim() !== analysis.decision.trim();
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const dash = (analysis.confidence.value / 100) * circumference;

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Logo />
        <p className="rounded-full bg-sand/80 px-3 py-1 text-xs tracking-wide text-espresso">
          Prepared demo
        </p>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-5 pb-20 sm:px-8 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-12">
        <nav
          aria-label="Verdict sections"
          className="sticky top-0 z-20 -mx-5 flex gap-2 overflow-x-auto border-b border-sand bg-ivory px-5 py-3 lg:static lg:mx-0 lg:flex-col lg:gap-1 lg:self-start lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0"
        >
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={active === section.id ? "true" : undefined}
              className={cn(
                "shrink-0 rounded-full px-3 py-2 text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass lg:rounded-xl lg:px-3",
                active === section.id
                  ? "bg-cream font-medium text-ink"
                  : "text-taupe hover:text-ink",
              )}
            >
              {section.label}
            </a>
          ))}
        </nav>

        <main id="content" className="min-w-0 space-y-14">
          <p className="max-w-2xl text-sm leading-6 text-taupe">
            Your decision: <span className="text-espresso">{question}</span>
            {differs
              ? " The findings below are a prepared example, so you can explore the verdict. They are not a live reading of a different question."
              : null}
          </p>
          {draftNote.length > 0 ? (
            <p className="text-sm text-taupe">
              Context from your draft is saved with the form and is not used to change these prepared scores.
            </p>
          ) : null}

          <section id="verdict" className="scroll-mt-24">
            <article className="rounded-[1.7rem] border border-sand bg-cream px-5 py-6 shadow-[0_24px_60px_-42px_rgba(60,40,20,0.55)] sm:px-8 sm:py-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-xl">
                  <p className="text-xs tracking-[0.18em] text-taupe uppercase">
                    The verdict
                  </p>
                  <h1 className="mt-3 font-serif text-5xl leading-none font-medium text-ink sm:text-6xl">
                    {analysis.leaning}
                  </h1>
                  <p className="mt-4 text-base leading-7 text-espresso/80">
                    {analysis.leaningSummary}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <svg viewBox="0 0 88 88" className="size-20" role="img" aria-label={`${analysis.confidence.value} percent analysis confidence`}>
                    <circle cx="44" cy="44" r={radius} fill="none" stroke="#e4d5c3" strokeWidth="6" />
                    <circle
                      cx="44"
                      cy="44"
                      r={radius}
                      fill="none"
                      stroke="#5f7f64"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${dash} ${circumference}`}
                      transform="rotate(-90 44 44)"
                    />
                    <text
                      x="44"
                      y="48"
                      textAnchor="middle"
                      className="fill-ink"
                      fontSize="16"
                      fontFamily="var(--font-geist-sans), sans-serif"
                    >
                      {analysis.confidence.value}%
                    </text>
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-ink">{analysis.confidence.label}</p>
                    <button
                      type="button"
                      className="mt-1 inline-flex items-center gap-1 rounded-full text-xs text-taupe focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
                      aria-expanded={confidenceOpen}
                      aria-controls={confidenceNoteId}
                      onClick={() => setConfidenceOpen((open) => !open)}
                    >
                      <Info className="size-3.5" aria-hidden="true" />
                      What this means
                    </button>
                  </div>
                </div>
              </div>
              <p
                id={confidenceNoteId}
                className={cn("mt-4 max-w-xl text-sm leading-6 text-espresso/75", confidenceOpen ? "block" : "sr-only")}
              >
                {analysis.confidence.note}
              </p>

              <ul className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2">
                {analysis.dimensions.map((dimension) => (
                  <li key={dimension.id}>
                    <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-espresso">{dimension.label}</span>
                      <span className="tabular-nums text-taupe">
                        {dimension.score}/{dimension.scale}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-sand" aria-hidden="true">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          dimension.tone === "sage" && "bg-sage",
                          dimension.tone === "brass" && "bg-brass",
                          dimension.tone === "terra" && "bg-terra",
                        )}
                        style={{ width: `${(dimension.score / dimension.scale) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <aside className="mt-8 rounded-2xl bg-terra-soft px-5 py-5">
                <h2 className="text-sm font-medium text-ink">Bottom line</h2>
                <p className="mt-2 text-sm leading-6 text-espresso/85">
                  {analysis.bottomLine}
                </p>
                <p className="mt-3 text-xs tracking-wide text-taupe uppercase">
                  Prepared demo copy
                </p>
              </aside>
            </article>
          </section>

          <section id="comparison" className="scroll-mt-24">
            <h2 className="font-serif text-4xl font-medium text-ink">For vs against</h2>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <CaseList
                eyebrow="The case for"
                points={analysis.forPoints}
                tone="sage"
              />
              <CaseList
                eyebrow="The case against"
                points={analysis.againstPoints}
                tone="terra"
              />
            </div>
          </section>

          <section id="insights" className="scroll-mt-24">
            <h2 className="font-serif text-4xl font-medium text-ink">Key insights</h2>
            <ol className="mt-6 space-y-4">
              {analysis.keyInsights.map((insight, index) => (
                <li key={insight} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
                  <span className="font-serif text-lg text-brass">{index + 1}</span>
                  <p className="text-base leading-7 text-espresso/85">{insight}</p>
                </li>
              ))}
            </ol>
          </section>

          <section id="change" className="scroll-mt-24">
            <h2 className="font-serif text-4xl font-medium text-ink">
              What would change the verdict?
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-espresso/75">
              Open a scenario to see why that change would move the reading.
            </p>
            <div className="mt-6">
              <ChangeFactors factors={analysis.changeFactors} />
            </div>
          </section>

          <section id="actions" className="scroll-mt-24">
            <h2 className="font-serif text-4xl font-medium text-ink">
              Recommended next steps
            </h2>
            <fieldset className="mt-6">
              <legend className="sr-only">Recommended next steps</legend>
              <ul className="space-y-3">
                {analysis.nextSteps.map((step) => (
                  <li key={step}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-sand bg-cream px-4 py-3">
                      <input
                        type="checkbox"
                        checked={Boolean(checked[step])}
                        onChange={() =>
                          setChecked((current) => ({
                            ...current,
                            [step]: !current[step],
                          }))
                        }
                        className="mt-1 size-4 accent-ink"
                      />
                      <span className="text-sm leading-6 text-espresso">{step}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          </section>

          <section id="summary" className="scroll-mt-24">
            <h2 className="font-serif text-4xl font-medium text-ink">Summary</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-espresso/85">
              {analysis.summary}
            </p>
            <Link
              href="/decide"
              className="mt-6 inline-flex text-sm text-espresso underline decoration-sand underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
            >
              Examine another decision
            </Link>
          </section>
        </main>
      </div>
    </div>
  );
}

function CaseList({
  eyebrow,
  points,
  tone,
}: {
  eyebrow: string;
  points: string[];
  tone: "sage" | "terra";
}) {
  return (
    <article className={cn("border-t-2 pt-4", tone === "sage" ? "border-sage" : "border-terra")}>
      <h3 className="text-xs tracking-[0.16em] text-taupe uppercase">{eyebrow}</h3>
      <ul className="mt-4 space-y-3">
        {points.map((point) => (
          <li key={point} className="text-sm leading-6 text-espresso">
            {point}
          </li>
        ))}
      </ul>
    </article>
  );
}
