"use client";

import { useState } from "react";
import type { ChangeFactor } from "@/types/analysis";
import { cn } from "@/lib/utils";

export function ChangeFactors({ factors }: { factors: ChangeFactor[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="grid gap-3 lg:grid-cols-3">
      {factors.map((factor) => {
        const open = openId === factor.id;
        const panelId = `why-${factor.id}`;
        return (
          <li key={factor.id}>
            <article
              className={cn(
                "h-full rounded-2xl border bg-cream transition-colors",
                open ? "border-brass/70" : "border-sand",
              )}
            >
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? null : factor.id)}
                className="flex w-full flex-col items-start rounded-2xl px-4 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
              >
                <span className="text-xs tracking-[0.14em] text-brass-deep uppercase">
                  {factor.condition}
                </span>
                <span className="mt-3 text-sm leading-6 text-espresso/85">
                  {factor.outcome}
                </span>
              </button>
              {open ? (
                <div id={panelId} role="region" aria-label="Why this matters" className="border-t border-sand px-4 pt-3 pb-4">
                  <h3 className="text-sm font-medium text-ink">Why this matters</h3>
                  <p className="mt-2 text-sm leading-6 text-espresso/80">
                    {factor.whyItMatters}
                  </p>
                </div>
              ) : null}
            </article>
          </li>
        );
      })}
    </ul>
  );
}
