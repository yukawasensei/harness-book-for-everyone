import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_MODEL = "ollama/qwen3.8:27b";

/** 仅由 run 调用；new/status/adopt 不依赖模型、网络或密钥。 */
export function configuredModel(root: string): { provider: string; id: string } {
  try { process.loadEnvFile(resolve(root, ".env")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("无法加载本包 .env，请检查格式与权限");
  }
  const full = process.env.MODEL_ID ?? DEFAULT_MODEL;
  const slash = full.indexOf("/");
  const provider = slash < 0 ? "ollama" : full.slice(0, slash);
  const id = slash < 0 ? full : full.slice(slash + 1);
  const config = JSON.parse(readFileSync(resolve(root, "pi-agent/models.json"), "utf8")) as {
    providers: Record<string, { models: { id: string }[] }>;
  };
  if (!config.providers[provider]?.models.some(m => m.id === id)) throw new Error("MODEL_ID 未在本包 pi-agent/models.json 配置");
  if (provider === "deepseek" && !process.env.DEEPSEEK_API_KEY?.trim()) {
    throw new Error("DeepSeek 需要 DEEPSEEK_API_KEY；放在 book/build/.env 或环境变量中");
  }
  return { provider, id };
}

export function scrubSecrets(text: string): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return text;
  for (const value of [JSON.stringify(key).slice(1, -1), key].sort((a, b) => b.length - a.length)) {
    text = text.split(value).join("[REDACTED]");
  }
  return text;
}
