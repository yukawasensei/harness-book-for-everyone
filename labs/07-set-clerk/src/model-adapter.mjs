/**
 * Model adapter for lab07: Ollama/qwen via env; swap later without changing stubs.
 *
 * Env:
 *   MODEL=ollama | stub          (default stub)
 *   OLLAMA_HOST=http://127.0.0.1:11434
 *   OLLAMA_MODEL=qwen3.8:27b     (or any local tag)
 *   MODEL_MAX_RETRIES=1
 *
 * Forces NO_PROXY so local proxies cannot hijack localhost Ollama.
 */
import { spawnSync } from "node:child_process";

export function getBackend() {
  const raw = (process.env.MODEL || process.env.SET_CLERK_BACKEND || "stub").toLowerCase().trim();
  if (raw === "ollama" || raw === "model" || raw === "qwen") return "ollama";
  return "stub";
}

export function ollamaConfig() {
  return {
    host: (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, ""),
    model: process.env.OLLAMA_MODEL || "qwen3.8:27b",
    maxRetries: Math.max(0, Number(process.env.MODEL_MAX_RETRIES ?? 1)),
  };
}

/** Env overlay that keeps Ollama on loopback even when the shell has HTTP(S)_PROXY set. */
export function noProxyEnv(base = process.env) {
  return {
    ...base,
    NO_PROXY: "127.0.0.1,localhost",
    no_proxy: "127.0.0.1,localhost",
    http_proxy: "",
    https_proxy: "",
    HTTP_PROXY: "",
    HTTPS_PROXY: "",
    ALL_PROXY: "",
    all_proxy: "",
  };
}

export async function ensureOllamaReachable() {
  const { host, model } = ollamaConfig();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000);
  try {
    const res = await fetch(`${host}/api/tags`, {
      signal: ac.signal,
      // undici respects env; we also strip proxies above for child processes
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const names = (body.models || []).map((m) => m.name);
    const ok =
      names.includes(model) ||
      names.some((n) => n === model || n.startsWith(`${model}:`) || n.startsWith("qwen"));
    return { ok: Boolean(names.length), host, model, names, modelPresent: names.includes(model) || ok };
  } catch (error) {
    return {
      ok: false,
      host,
      model,
      names: [],
      modelPresent: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generate text from Ollama /api/generate (non-stream).
 */
export async function ollamaGenerate({ prompt, system, temperature = 0.2 }) {
  const { host, model } = ollamaConfig();
  // Apply no-proxy for this process so fetch to 127.0.0.1 is not hijacked.
  Object.assign(process.env, noProxyEnv());

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Number(process.env.OLLAMA_TIMEOUT_MS || 120_000));
  try {
    const res = await fetch(`${host}/api/generate`, {
      signal: ac.signal,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: system ? `${system}\n\n${prompt}` : prompt,
        stream: false,
        options: { temperature },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama generate HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const body = await res.json();
    return { text: String(body.response || ""), model, raw: body };
  } finally {
    clearTimeout(timer);
  }
}

/** Pull first JSON object/array from model prose (fences or bare). */
export function parseJsonFromModelText(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("empty model text");
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const startObj = candidate.indexOf("{");
    const startArr = candidate.indexOf("[");
    let start = -1;
    if (startObj >= 0 && (startArr < 0 || startObj < startArr)) start = startObj;
    else start = startArr;
    if (start < 0) throw new Error("no JSON found in model text");
    const slice = candidate.slice(start);
    // brace match
    const open = slice[0];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] === open) depth++;
      else if (slice[i] === close) {
        depth--;
        if (depth === 0) {
          return JSON.parse(slice.slice(0, i + 1));
        }
      }
    }
    throw new Error("unbalanced JSON in model text");
  }
}

export function hasRequiredFields(obj, fields) {
  if (!obj || typeof obj !== "object") return false;
  return (fields || []).every((f) => f in obj);
}

/**
 * Call model with retries; on exhaustion return { ok:false }.
 * parse(text) should throw if invalid.
 */
export async function generateWithParse({ prompt, system, parse, trace }) {
  const { maxRetries, model } = ollamaConfig();
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    trace?.emit?.({
      eventType: "model_call",
      backend: "ollama",
      model,
      attempt,
    });
    try {
      const { text } = await ollamaGenerate({ prompt, system });
      const value = parse(text);
      trace?.emit?.({
        eventType: "model_parse_ok",
        backend: "ollama",
        model,
        attempt,
        chars: text.length,
      });
      return { ok: true, value, text, model, attempt };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      trace?.emit?.({
        eventType: "model_parse_fail",
        backend: "ollama",
        model,
        attempt,
        error: lastError,
      });
    }
  }
  return { ok: false, error: lastError, model };
}

/** Sync helper used only by diagnostics; prefer async API in skills. */
export function probeOllamaSync() {
  Object.assign(process.env, noProxyEnv());
  const { host } = ollamaConfig();
  const r = spawnSync(
    process.execPath,
    [
      "-e",
      `fetch(${JSON.stringify(host + "/api/tags")}).then(r=>r.json()).then(j=>{console.log(JSON.stringify(j));}).catch(e=>{console.error(e);process.exit(1);})`,
    ],
    { encoding: "utf8", env: noProxyEnv(), timeout: 8000 },
  );
  return r;
}
