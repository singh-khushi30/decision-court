import { analyzeDecision } from "@/lib/agents/analyze";
import { providerLogFields } from "@/lib/ai/errors";
import { logEvent } from "@/lib/ai/log";
import { messageForCategory, messageForStatus } from "@/lib/ai/messages";
import { resolveGeminiModel } from "@/lib/ai/model";
import { clientKey, consumeRateLimit } from "@/lib/rate-limit";
import {
  decisionRequestError,
  decisionRequestSchema,
} from "@/lib/schemas/decision-request";
import { MAX_REQUEST_BYTES } from "@/lib/schemas/limits";

export async function POST(request: Request) {
  const started = Date.now();
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return jsonError(413);
  }

  const raw = await request.text();
  if (raw.length > MAX_REQUEST_BYTES) return jsonError(413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, "The request could not be read.");
  }

  const parsed = decisionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, decisionRequestError(parsed.error));
  }

  const limit = consumeRateLimit(clientKey(request));
  if (!limit.ok) {
    return jsonError(429, undefined, { "Retry-After": String(limit.retryAfterSec) });
  }

  logEvent("decision_request_accepted", { model: resolveGeminiModel() });

  try {
    const result = await analyzeDecision(parsed.data);
    if (!result.ok) {
      const mapped = messageForCategory(result.failure.category);
      logEvent("provider_failure", {
        category: result.failure.category,
        node: result.failure.node,
        status: mapped.status,
        durationMs: Date.now() - started,
        model: resolveGeminiModel(),
        ...providerLogFields({
          status: result.failure.providerStatus,
          code: result.failure.providerCode,
          message: result.failure.providerMessage,
        }),
      });
      return jsonError(mapped.status, mapped.message);
    }

    logEvent("decision_analysis_completed", {
      model: resolveGeminiModel(),
      durationMs: Date.now() - started,
    });
    return Response.json(result.analysis);
  } catch {
    logEvent("provider_failure", {
      category: "generic",
      status: 500,
      durationMs: Date.now() - started,
      model: resolveGeminiModel(),
    });
    return jsonError(500);
  }
}

function jsonError(status: number, message = messageForStatus(status), headers?: HeadersInit) {
  return Response.json({ error: message }, { status, headers });
}
