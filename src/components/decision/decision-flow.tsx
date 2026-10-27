"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Logo } from "@/components/brand/logo";
import { ContextFields } from "@/components/decision/context-fields";
import { ProgressSteps } from "@/components/decision/progress-steps";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { findDecisionExample } from "@/lib/demo/decision";
import {
  DECISION_LIMIT,
  decisionDraftSchema,
  emptyDecisionDraft,
  writeDecisionDraft,
  type DecisionDraft,
  type DecisionStep,
  type StoredDecisionDraft,
} from "@/lib/decision-draft";
import { useDecisionDraft, useIsClient } from "@/lib/use-decision-draft";

const pillClass =
  "h-11 rounded-full bg-ink px-5 text-parchment hover:bg-espresso focus-visible:outline-brass";

export function DecisionFlow({ exampleId }: { exampleId?: string | null }) {
  const ready = useIsClient();
  const stored = useDecisionDraft();

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Logo />
        <Link
          href="/"
          className="rounded-full px-2 py-1 text-sm text-taupe transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
        >
          Exit
        </Link>
      </header>
      {ready ? (
        <DecisionForm exampleId={exampleId} stored={stored} />
      ) : (
        <main id="content" className="mx-auto w-full max-w-3xl px-5 pt-4 pb-16 sm:px-8">
          <div className="mx-auto max-w-2xl">
            <h1 className="font-serif text-4xl leading-tight font-medium text-ink sm:text-5xl">
              What decision are you considering?
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-espresso/75">
              Describe your situation in as much detail as you&apos;re comfortable with.
            </p>
          </div>
        </main>
      )}
    </div>
  );
}

function DecisionForm({
  exampleId,
  stored,
}: {
  exampleId?: string | null;
  stored: StoredDecisionDraft | null;
}) {
  const example = findDecisionExample(exampleId);
  const starting = example
    ? { draft: { ...emptyDecisionDraft, decision: example.prompt }, step: 1 as const }
    : (stored ?? { draft: emptyDecisionDraft, step: 1 as const });
  const [step, setStep] = useState<DecisionStep>(starting.step);
  const [count, setCount] = useState(starting.draft.decision.length);
  const [review, setReview] = useState<DecisionDraft>(starting.draft);
  const form = useForm<DecisionDraft>({
    resolver: zodResolver(decisionDraftSchema),
    defaultValues: starting.draft,
    mode: "onSubmit",
  });
  const decisionError = form.formState.errors.decision?.message;
  const decisionField = form.register("decision");

  function persist(nextStep: DecisionStep) {
    const draft = form.getValues();
    writeDecisionDraft(draft, nextStep);
    setReview(draft);
    setStep(nextStep);
  }

  return (
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pt-4 pb-16 sm:px-8">
        <div className="mb-10 flex justify-center">
          <ProgressSteps step={step} />
        </div>

        {step === 1 ? (
          <section aria-labelledby="decision-heading" className="mx-auto w-full max-w-2xl">
            <h1
              id="decision-heading"
              className="font-serif text-4xl leading-tight font-medium text-ink sm:text-5xl"
            >
              What decision are you considering?
            </h1>
            <p id="decision-help" className="mt-4 max-w-lg text-base leading-7 text-espresso/75">
              Describe your situation in as much detail as you&apos;re comfortable with.
            </p>
            <div className="mt-8">
              <Label htmlFor="decision" className="sr-only">
                Decision
              </Label>
              <Textarea
                id="decision"
                placeholder="Should I leave my stable job for an early-stage startup?"
                maxLength={DECISION_LIMIT}
                aria-invalid={Boolean(decisionError)}
                aria-describedby={
                  decisionError
                    ? "decision-help decision-count decision-error"
                    : "decision-help decision-count"
                }
                className="field-sizing-fixed min-h-48 rounded-2xl border-sand bg-cream px-4 py-4 text-base leading-relaxed md:text-base"
                {...decisionField}
                onChange={(event) => {
                  decisionField.onChange(event);
                  setCount(event.target.value.length);
                }}
              />
              <div className="mt-2 flex items-start justify-between gap-4">
                {decisionError ? (
                  <p id="decision-error" role="alert" className="text-sm text-terra">
                    {decisionError}
                  </p>
                ) : (
                  <span />
                )}
                <p
                  id="decision-count"
                  className={`shrink-0 text-xs tabular-nums ${count > DECISION_LIMIT * 0.9 ? "text-terra" : "text-taupe"}`}
                >
                  <span className="sr-only">Character count </span>
                  {count}/{DECISION_LIMIT}
                </p>
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <Button
                type="button"
                className={pillClass}
                onClick={async () => {
                  const valid = await form.trigger("decision");
                  if (!valid) return;
                  persist(2);
                }}
              >
                Next
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section aria-labelledby="context-heading" className="w-full">
            <h1
              id="context-heading"
              className="font-serif text-4xl leading-tight font-medium text-ink sm:text-5xl"
            >
              Add more context
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-espresso/75">
              Optional. Include details about your goals, constraints, and timeline.
            </p>
            <div className="mt-8">
              <ContextFields
                register={form.register}
                errors={form.formState.errors}
                defaults={starting.draft}
              />
            </div>
            <div className="mt-8 flex items-center justify-between gap-4">
              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-full px-4 text-espresso hover:bg-sand/70"
                onClick={() => persist(1)}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back
              </Button>
              <Button
                type="button"
                className={pillClass}
                onClick={async () => {
                  const valid = await form.trigger([
                    "situation",
                    "goals",
                    "constraints",
                    "timeline",
                  ]);
                  if (!valid) {
                    return;
                  }
                  persist(3);
                }}
              >
                Next
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section aria-labelledby="review-heading" className="mx-auto w-full max-w-2xl">
            <h1
              id="review-heading"
              className="font-serif text-4xl leading-tight font-medium text-ink sm:text-5xl"
            >
              Review your decision
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-espresso/75">
              This summary is what you will carry into the prepared demo. No model is called.
            </p>
            <dl className="mt-8 divide-y divide-sand rounded-3xl border border-sand bg-cream">
              <ReviewItem label="Decision" value={review.decision} />
              <ReviewItem label="Current situation" value={review.situation} />
              <ReviewItem label="Goals" value={review.goals} />
              <ReviewItem label="Constraints" value={review.constraints} />
              <ReviewItem label="Timeline" value={review.timeline} />
            </dl>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-full px-4 text-espresso hover:bg-sand/70"
                onClick={() => persist(2)}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back
              </Button>
              <div className="flex flex-col items-end gap-2">
                <Link
                  href="/analysis/demo"
                  onClick={() => writeDecisionDraft(form.getValues(), 3)}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-parchment transition-colors hover:bg-espresso focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
                >
                  Analyze with AI Agents
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <p className="text-xs text-taupe">Opens a prepared demo.</p>
              </div>
            </div>
          </section>
        ) : null}
      </main>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  const text = value.trim();
  return (
    <div className="grid gap-1 px-5 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
      <dt className="text-sm text-taupe">{label}</dt>
      <dd className="text-sm leading-6 text-ink">{text || "Not added"}</dd>
    </div>
  );
}
