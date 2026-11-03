import { z } from "zod";
import { CONTEXT_MAX, DECISION_MAX, DECISION_MIN } from "@/lib/schemas/limits";

export const decisionTextSchema = z.string().trim().superRefine((value, context) => {
  if (!value) {
    context.addIssue({
      code: "custom",
      message: "Describe the decision you want to examine.",
    });
    return;
  }
  if (value.length < DECISION_MIN) {
    context.addIssue({
      code: "custom",
      message: "Add a little more detail so the analysis has something to examine.",
    });
  }
  if (value.length > DECISION_MAX) {
    context.addIssue({
      code: "custom",
      message: `Keep the decision under ${DECISION_MAX} characters.`,
    });
  }
});

const contextTextSchema = z
  .string()
  .trim()
  .max(CONTEXT_MAX, `Keep this under ${CONTEXT_MAX} characters.`);

export const decisionRequestSchema = z.object({
  decision: decisionTextSchema,
  context: z
    .object({
      currentSituation: contextTextSchema.default(""),
      goals: contextTextSchema.default(""),
      constraints: contextTextSchema.default(""),
      timeline: contextTextSchema.default(""),
    })
    .default({
      currentSituation: "",
      goals: "",
      constraints: "",
      timeline: "",
    }),
});

export type DecisionRequest = z.infer<typeof decisionRequestSchema>;

export function decisionRequestError(error: z.ZodError): string {
  const message = error.issues[0]?.message;
  if (typeof message === "string" && message.length > 0 && message.length <= 180) {
    return message;
  }
  return "Check the decision and try again.";
}
