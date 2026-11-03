/**
 * Default for this project. gemini-2.5-flash returns 404 for new users.
 * GEMINI_MODEL overrides this when it is non-empty.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-3.6-flash";

export function resolveGeminiModel(
  env: Record<string, string | undefined> = process.env,
): string {
  const configured = env.GEMINI_MODEL?.trim();
  return configured || DEFAULT_GEMINI_MODEL;
}

export function resolveGeminiFallbackModel(
  env: Record<string, string | undefined> = process.env,
): string {
  const configured = env.GEMINI_FALLBACK_MODEL?.trim();
  return configured || DEFAULT_GEMINI_FALLBACK_MODEL;
}
