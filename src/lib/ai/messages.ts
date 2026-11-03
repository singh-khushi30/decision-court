export const analysisMessages = {
  unavailable: "Decision Court couldn't complete the analysis right now. Please try again.",
  timeout: "The analysis took too long to finish. Please try again.",
  rateLimit: "You've run several analyses recently. Please try again in a few minutes.",
  tooLarge: "That request is too large to analyze.",
  invalid: "Check the decision and try again.",
  malformed:
    "The analysis didn't come back in a usable form. Please try again.",
} as const;

export function messageForStatus(status: number): string {
  if (status === 413) return analysisMessages.tooLarge;
  if (status === 429) return analysisMessages.rateLimit;
  if (status === 504) return analysisMessages.timeout;
  if (status === 400) return analysisMessages.invalid;
  return analysisMessages.unavailable;
}

export function messageForCategory(category: string): { status: number; message: string } {
  if (category === "timeout") {
    return { status: 504, message: analysisMessages.timeout };
  }
  if (category === "rate_limit") {
    return { status: 429, message: analysisMessages.rateLimit };
  }
  if (category === "unavailable") {
    return { status: 503, message: analysisMessages.unavailable };
  }
  if (category === "invalid_output" || category === "empty_output") {
    return { status: 500, message: analysisMessages.malformed };
  }
  // authentication, invalid_request, and model_not_found are integration
  // failures. The browser only receives the same calm message.
  return { status: 500, message: analysisMessages.unavailable };
}
