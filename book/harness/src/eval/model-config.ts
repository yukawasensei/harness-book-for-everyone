import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_MODEL } from "./stability.js";
import { scrubSecrets } from "../secrets.js";

export function splitModelId(value: string): { provider: string; id: string; fullId: string } {
  const slash = value.indexOf("/");
  const provider = slash < 0 ? "ollama" : value.slice(0, slash);
  const id = slash < 0 ? value : value.slice(slash + 1);
  return { provider, id, fullId: `${provider}/${id}` };
}

const loaded = new Set<string>();
function loadStartupEnv(root: string) {
  const path = resolve(root, ".env");
  if (loaded.has(path)) return;
  try {
    process.loadEnvFile(path); // Node preserves existing environment values. Never log the file.
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Cannot load book/harness/.env; check its format and permissions");
  }
  loaded.add(path);
}

export function validateModel(config: unknown, modelId: string): string {
  const { provider, id, fullId } = splitModelId(modelId);
  const models = (config as { providers?: Record<string, { models?: { id: string }[] }> })?.providers?.[provider]?.models;
  if (!provider || !id || !Array.isArray(models) || !models.some(m => m.id === id)) {
    throw new Error(scrubSecrets(`${fullId} not configured in pi-agent/models.json; add an entry under providers.${provider}.models and set MODEL_ID=provider/model`));
  }
  return fullId;
}

export function configuredModel(root: string): string {
  loadStartupEnv(root);
  const model = validateModel(JSON.parse(readFileSync(resolve(root, "pi-agent/models.json"), "utf8")), process.env.MODEL_ID ?? DEFAULT_MODEL);
  if (splitModelId(model).provider === "deepseek" && !process.env.DEEPSEEK_API_KEY?.trim()) {
    throw new Error("DEEPSEEK_API_KEY is required: set it in the environment or book/harness/.env (see .env.example)");
  }
  return model;
}

// npm start 的提前检查；不创建会话、不生成 trace、不调用模型。
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  configuredModel(resolve(dirname(fileURLToPath(import.meta.url)), "../.."));
}
