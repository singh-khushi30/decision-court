// In-memory and per server process. This is a best-effort demo limiter.
// It is not a distributed production rate limiter and resets on restart.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;

const hits = new Map<string, number[]>();

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwarded || realIp || "local";
}

export function consumeRateLimit(key: string, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  if (recent.length >= LIMIT) {
    const retryAfterSec = Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000));
    hits.set(key, recent);
    return { ok: false as const, retryAfterSec };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true as const };
}

export function resetRateLimitForTests() {
  hits.clear();
}
