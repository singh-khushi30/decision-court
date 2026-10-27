"use client";

import { CalendarDays, Compass, Flag, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTEXT_LIMIT,
  type DecisionDraft,
} from "@/lib/decision-draft";
import { cn } from "@/lib/utils";

const fields: {
  key: keyof Pick<
    DecisionDraft,
    "situation" | "goals" | "constraints" | "timeline"
  >;
  title: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    key: "situation",
    title: "Current situation",
    hint: "Where you are right now",
    icon: Compass,
  },
  {
    key: "goals",
    title: "Your goals",
    hint: "What you want to achieve",
    icon: Flag,
  },
  {
    key: "constraints",
    title: "Constraints",
    hint: "Budget, time, responsibilities, etc.",
    icon: Scale,
  },
  {
    key: "timeline",
    title: "Timeline",
    hint: "When you need to decide",
    icon: CalendarDays,
  },
];

type ContextFieldsProps = {
  register: UseFormRegister<DecisionDraft>;
  errors: FieldErrors<DecisionDraft>;
  defaults: DecisionDraft;
};

export function ContextFields({ register, errors, defaults }: ContextFieldsProps) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {fields.map((field) => (
        <ContextCard
          key={field.key}
          field={field}
          open={open === field.key}
          onToggle={() => setOpen(open === field.key ? null : field.key)}
          register={register}
          error={errors[field.key]?.message}
          defaultValue={defaults[field.key]}
        />
      ))}
    </ul>
  );
}

function ContextCard({
  field,
  open,
  onToggle,
  register,
  error,
  defaultValue,
}: {
  field: (typeof fields)[number];
  open: boolean;
  onToggle: () => void;
  register: UseFormRegister<DecisionDraft>;
  error?: string;
  defaultValue: string;
}) {
  const [preview, setPreview] = useState(defaultValue.trim());
  const fieldId = `context-${field.key}`;
  const registration = register(field.key);

  return (
    <li>
      <div
        className={cn(
          "rounded-2xl border bg-cream transition-colors",
          open ? "border-brass/70" : "border-sand",
        )}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? fieldId : undefined}
          onClick={onToggle}
          className="flex w-full items-start gap-3 rounded-2xl px-4 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          <field.icon
            className="mt-0.5 size-4 shrink-0 text-brass"
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">{field.title}</span>
            <span className="mt-1 block truncate text-sm text-taupe">
              {preview && !open ? preview : field.hint}
            </span>
          </span>
        </button>
        {open ? (
          <div id={fieldId} className="px-4 pb-4">
            <Label htmlFor={`${fieldId}-input`} className="sr-only">
              {field.title}
            </Label>
            <Textarea
              id={`${fieldId}-input`}
              maxLength={CONTEXT_LIMIT}
              autoFocus
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${fieldId}-error` : undefined}
              className="field-sizing-fixed min-h-28 rounded-xl border-sand bg-parchment px-3 py-3 text-base md:text-base"
              {...registration}
              onChange={(event) => {
                registration.onChange(event);
                setPreview(event.target.value.trim());
              }}
            />
            {error ? (
              <p id={`${fieldId}-error`} role="alert" className="mt-2 text-sm text-terra">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
