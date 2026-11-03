import { createServer } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function loadEnvLocal() {
  const path = resolve(root, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const cleaned = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const eq = cleaned.indexOf("=");
    if (eq <= 0) continue;
    const key = cleaned.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = cleaned.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function sanitize(value) {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b(?:key|api[_-]?key|token|authorization)\s*[:=]\s*\S+/gi, "[redacted]")
    .replace(/\bBearer\s+\S+/gi, "[redacted]")
    .replace(/\bAIza[0-9A-Za-z_-]{8,}\b/g, "[redacted]")
    .trim()
    .slice(0, 180);
}

loadEnvLocal();
process.env.DECISION_COURT_SMOKE = "1";

const server = await createServer({
  configFile: false,
  root,
  logLevel: "silent",
  resolve: { alias: { "@": resolve(root, "src") } },
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
});

try {
  const mod = await server.ssrLoadModule("/src/lib/ai/gemini-smoke.ts");
  const report = await mod.runGeminiSmoke();
  console.log(JSON.stringify(report));
  process.exitCode = report.success ? 0 : 1;
} catch (error) {
  const message = error instanceof Error ? error.message : "The smoke runner failed.";
  console.log(
    JSON.stringify({
      model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
      success: false,
      durationMs: 0,
      category: "generic",
      message: sanitize(message),
    }),
  );
  process.exitCode = 1;
} finally {
  await server.close();
}
