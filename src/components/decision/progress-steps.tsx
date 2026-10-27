import { Check } from "lucide-react";
import type { DecisionStep } from "@/lib/decision-draft";
import { cn } from "@/lib/utils";

const steps: { id: DecisionStep; label: string }[] = [
  { id: 1, label: "Your decision" },
  { id: 2, label: "Context" },
  { id: 3, label: "Review & Analyze" },
];

export function ProgressSteps({ step }: { step: DecisionStep }) {
  return (
    <ol aria-label="Progress" className="flex flex-wrap items-center gap-x-3 gap-y-3">
      {steps.map((item, index) => {
        const complete = step > item.id;
        const current = step === item.id;
        return (
          <li
            key={item.id}
            className="flex items-center gap-3"
            aria-current={current ? "step" : undefined}
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-medium",
                  complete && "bg-sage text-parchment",
                  current && "bg-ink text-parchment",
                  !complete && !current && "bg-sand text-taupe",
                )}
              >
                {complete ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : (
                  item.id
                )}
              </span>
              <span
                className={cn(
                  "text-sm",
                  current ? "font-medium text-ink" : "text-taupe",
                )}
              >
                {item.label}
              </span>
            </span>
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className="hidden h-px w-8 bg-sand sm:block sm:w-12"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
