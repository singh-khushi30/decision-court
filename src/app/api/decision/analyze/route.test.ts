import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitForTests } from "@/lib/rate-limit";
import type { DecisionAnalysis } from "@/types/analysis";

vi.mock("@/lib/agents/analyze", () => ({
  analyzeDecision: vi.fn(),
}));

import { analyzeDecision } from "@/lib/agents/analyze";
import { POST } from "@/app/api/decision/analyze/route";

const analyze = vi.mocked(analyzeDecision);

const analysis = {
  id: "result-1",
  decision: "Should I move cities for a year?",
  leaning: "Finely balanced",
} as DecisionAnalysis;

function post(body: string, headers?: HeadersInit) {
  return POST(
    new Request("http://localhost/api/decision/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
    }),
  );
}

describe("POST /api/decision/analyze", () => {
  beforeEach(() => {
    resetRateLimitForTests();
    analyze.mockReset();
    analyze.mockResolvedValue({ ok: true, analysis });
  });

  it("returns the analysis for a valid request", async () => {
    const response = await post(
      JSON.stringify({ decision: "Should I move cities for a year?" }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      decision: "Should I move cities for a year?",
    });
    expect(analyze).toHaveBeenCalledOnce();
  });

  it("returns 400 for an empty decision", async () => {
    const response = await post(JSON.stringify({ decision: "   " }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/describe the decision/i),
    });
    expect(analyze).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await post("{");
    expect(response.status).toBe(400);
    expect(analyze).not.toHaveBeenCalled();
  });

  it("returns 413 for an oversized payload", async () => {
    const response = await post(JSON.stringify({ decision: "x".repeat(20_000) }));
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: "That request is too large to analyze.",
    });
    expect(analyze).not.toHaveBeenCalled();
  });

  it("returns 429 after five analyses for the same client", async () => {
    const body = JSON.stringify({ decision: "Should I move cities for a year?" });
    for (let index = 0; index < 5; index += 1) {
      expect((await post(body)).status).toBe(200);
    }
    const limited = await post(body);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
    await expect(limited.json()).resolves.toMatchObject({
      error: "You've run several analyses recently. Please try again in a few minutes.",
    });
    expect(analyze).toHaveBeenCalledTimes(5);
  });

  it("returns 503 when the provider is unavailable", async () => {
    analyze.mockResolvedValue({
      ok: false,
      failure: { category: "unavailable", node: "build_cases" },
    });
    const response = await post(
      JSON.stringify({ decision: "Should I move cities for a year?" }),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "Decision Court couldn't complete the analysis right now. Please try again.",
    });
  });

  it("returns 504 when the analysis times out", async () => {
    analyze.mockResolvedValue({
      ok: false,
      failure: { category: "timeout", node: "evaluate_evidence" },
    });
    const response = await post(
      JSON.stringify({ decision: "Should I move cities for a year?" }),
    );
    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({
      error: "The analysis took too long to finish. Please try again.",
    });
  });
});
