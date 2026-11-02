import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_MODEL } from "./stability.js";

export function validateModel(config: unknown, modelId: string): string {
  const models = (config as { providers?: { ollama?: { models?: { id: string }[] } } })?.providers?.ollama?.models;
  if (!Array.isArray(models) || !models.some(m => m.id === modelId)) {
    throw new Error(`ollama/${modelId} not configured in pi-agent/models.json; add an entry under providers.ollama.models and set MODEL_ID to its exact id`);
  }
  return modelId;
}

export function configuredModel(root: string): string {
  return validateModel(JSON.parse(readFileSync(resolve(root, "pi-agent/models.json"), "utf8")), process.env.MODEL_ID ?? DEFAULT_MODEL);
}

// npm start 的提前检查；不创建会话、不生成 trace、不调用模型。
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  configuredModel(resolve(dirname(fileURLToPath(import.meta.url)), "../.."));
}
