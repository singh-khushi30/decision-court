import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const PAGE_LIMIT = 20;

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

function sanitize(value, secret) {
  let text = String(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (secret) text = text.split(secret).join("[redacted]");
  return text
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b(?:key|api[_-]?key|token|authorization)\s*[:=]\s*\S+/gi, "[redacted]")
    .replace(/\bBearer\s+\S+/gi, "[redacted]")
    .replace(/\bAIza[0-9A-Za-z_-]{8,}\b/g, "[redacted]")
    .slice(0, 180);
}

function flashRank(model) {
  const label = `${model.name} ${model.displayName ?? ""}`.toLowerCase();
  return label.includes("flash") ? 0 : 1;
}

function listedModel(model) {
  if (!model || typeof model !== "object") return null;
  const name = typeof model.name === "string" ? model.name.trim() : "";
  const methods = Array.isArray(model.supportedGenerationMethods)
    ? model.supportedGenerationMethods.filter((method) => typeof method === "string" && method.trim())
    : [];
  if (!name || !methods.includes("generateContent")) return null;
  const entry = { name, supportedGenerationMethods: methods };
  const displayName = typeof model.displayName === "string" ? model.displayName.trim() : "";
  if (displayName) entry.displayName = displayName;
  return entry;
}

async function listModels(apiKey) {
  const models = [];
  let pageToken = "";

  for (let page = 0; page < PAGE_LIMIT; page += 1) {
    const url = new URL(MODELS_URL);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { "x-goog-api-key": apiKey },
    });
    const raw = await response.text();
    let body = null;
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }

    if (!response.ok) {
      const message =
        body && typeof body === "object" && body.error && typeof body.error.message === "string"
          ? body.error.message
          : raw;
      const error = new Error(sanitize(message, apiKey) || "The model list could not be read.");
      error.status = response.status;
      throw error;
    }

    const pageModels = body && Array.isArray(body.models) ? body.models : [];
    for (const model of pageModels) {
      const entry = listedModel(model);
      if (entry) models.push(entry);
    }

    pageToken = body && typeof body.nextPageToken === "string" ? body.nextPageToken : "";
    if (!pageToken) break;
  }

  return models.sort((left, right) => flashRank(left) - flashRank(right));
}

loadEnvLocal();
const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";

if (!apiKey) {
  console.log(JSON.stringify({ error: "missing_api_key" }));
  process.exitCode = 1;
} else {
  try {
    const models = await listModels(apiKey);
    console.log(JSON.stringify(models, null, 2));
  } catch (error) {
    const status = error && typeof error === "object" && typeof error.status === "number" ? error.status : undefined;
    const message = error instanceof Error ? error.message : "The model list could not be read.";
    console.log(
      JSON.stringify({
        error: "models_list_failed",
        ...(status !== undefined ? { status } : {}),
        message: sanitize(message, apiKey),
      }),
    );
    process.exitCode = 1;
  }
}
