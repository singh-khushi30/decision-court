import { ArrowRight, Compass, Scale, ScrollText } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/brand/site-header";
import { HeroVisual } from "@/components/landing/hero-visual";
import { decisionExamples } from "@/lib/demo/decision";

const features = [
  {
    title: "Multiple perspectives",
    body: "See the full picture",
    icon: Scale,
  },
  {
    title: "Evidence-based analysis",
    body: "Not just gut feelings",
    icon: ScrollText,
  },
  {
    title: "Actionable insights",
    body: "Know what to do next",
    icon: Compass,
  },
];

const process = [
  {
    index: "01",
    title: "The Advocate",
    body: "Builds the strongest honest case for the choice.",
  },
  {
    index: "02",
    title: "The Challenger",
    body: "Builds the strongest honest case against it.",
  },
  {
    index: "03",
    title: "The record",
    body: "Assumptions are tested. Evidence and uncertainty are weighed.",
  },
  {
    index: "04",
    title: "The verdict",
    body: "A balanced reading, plus the factors that would change it.",
  },
];

export function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main id="content">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pt-4 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12 lg:pt-2 lg:pb-20">
          <div>
            <h1 className="font-serif text-[2.55rem] leading-[0.92] font-semibold tracking-[-0.03em] text-ink sm:text-5xl lg:text-[4.5rem]">
              <span className="block">Better decisions for</span>
              <span className="mt-1 block">
                a <span className="text-brass-deep">calmer you.</span>
              </span>
            </h1>
            <p className="mt-7 max-w-sm text-base leading-7 text-espresso/80 sm:text-[1.05rem]">
              Two AI agents argue both sides.
              <br />
              A judge evaluates the evidence.
              <br />
              You get a clear, balanced verdict.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link
                href="/decide"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-parchment transition-colors hover:bg-espresso focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
              >
                Start a Decision
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <p className="font-script rotate-[-8deg] text-[1.7rem] leading-none text-brass-deep">
                <span aria-hidden="true">← </span>
                Takes 2 minutes
              </p>
            </div>
          </div>
          <HeroVisual />
        </section>

        <section
          aria-label="What Decision Court offers"
          className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8"
        >
          <ul className="grid gap-8 border-t border-sand pt-8 sm:grid-cols-3 sm:gap-0">
            {features.map((feature) => (
              <li
                key={feature.title}
                className="flex gap-4 sm:px-6 sm:first:pl-0 sm:last:pr-0 sm:[&:not(:last-child)]:border-r sm:[&:not(:last-child)]:border-sand"
              >
                <feature.icon
                  className="mt-0.5 size-5 shrink-0 text-brass"
                  aria-hidden="true"
                />
                <div>
                  <h2 className="text-sm font-medium text-ink">{feature.title}</h2>
                  <p className="mt-1 text-sm text-taupe">{feature.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="how-it-works"
          className="scroll-mt-8 border-t border-sand/80"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:py-24">
            <div>
              <p className="text-xs tracking-[0.18em] text-taupe uppercase">
                How it works
              </p>
              <h2 className="mt-3 max-w-xs font-serif text-4xl leading-tight font-medium text-ink sm:text-5xl">
                Two arguments. One quieter verdict.
              </h2>
            </div>
            <ol className="grid gap-8 sm:grid-cols-2">
              {process.map((step) => (
                <li key={step.index}>
                  <p className="font-serif text-sm tracking-[0.16em] text-brass">
                    {step.index}
                  </p>
                  <h3 className="mt-2 font-serif text-2xl font-medium text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-espresso/75">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="examples" className="scroll-mt-8 border-t border-sand/80">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.18em] text-taupe uppercase">
                  Examples
                </p>
                <h2 className="mt-3 font-serif text-4xl font-medium text-ink sm:text-5xl">
                  Begin with a real question.
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-taupe">
                An example fills the form. The analysis screens then show one
                prepared case, so you can walk the full experience.
              </p>
            </div>
            <ul className="mt-10 divide-y divide-sand border-y border-sand">
              {decisionExamples.map((example) => (
                <li key={example.id}>
                  <Link
                    href={`/decide?example=${example.id}`}
                    className="group flex flex-col gap-2 py-6 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span>
                      <span className="block font-serif text-2xl font-medium text-ink sm:text-3xl">
                        {example.prompt}
                      </span>
                      <span className="mt-1 block text-sm text-taupe">
                        {example.note}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-2 text-sm text-espresso/80">
                      Try this decision
                      <ArrowRight
                        className="size-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="about" className="scroll-mt-8 border-t border-sand/80">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-24">
            <h2 className="font-serif text-4xl leading-tight font-medium text-ink sm:text-5xl">
              A calmer way to hold a hard choice.
            </h2>
            <div className="max-w-xl space-y-4 text-base leading-7 text-espresso/80">
              <p>
                Decision Court is a multi-agent decision-analysis system. It
                uses adversarial reasoning, evidence, and your own context to
                examine a difficult decision from more than one side.
              </p>
              <p>
                This preview is the interface. The Advocate, Challenger, and
                Judge are represented with a prepared demo, so you can see the
                shape of a verdict before a live model is connected.
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="mt-auto border-t border-sand/80">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-taupe sm:px-8">
          <p>Decision Court</p>
          <p>Under development · demo analysis only</p>
        </div>
      </footer>
    </div>
  );
}
