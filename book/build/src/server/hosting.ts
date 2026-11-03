import { timingSafeEqual } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { resolve } from "node:path";
import { assertId, containedPath, tenantRoot } from "../project/paths.js";
import type { RunOutcome } from "./protocol.js";
import type { Stage } from "../contracts/index.js";
import { HttpError } from "./http.js";

export interface HostingOptions {
  mode: "local" | "hosted";
  tokens?: Record<string, string>;
  host?: string;
  origin?: string;
  maxConcurrent?: number;
  dailyRuns?: number;
}
export function hostingFromEnv(env: NodeJS.ProcessEnv = process.env): HostingOptions {
  const mode = env.HARNESS_MODE ?? "local";
  if (mode !== "local" && mode !== "hosted") throw new Error("HARNESS_MODE 只能为 local 或 hosted");
  if (mode === "local") return { mode };
  let tokens: Record<string, string>;
  try {
    const raw = env.HARNESS_ACCESS_TOKENS ?? (env.HARNESS_ACCESS_TOKENS_FILE ? readFileSync(env.HARNESS_ACCESS_TOKENS_FILE, "utf8") : "{}");
    tokens = JSON.parse(raw);
  } catch { throw new Error("无法加载访问令牌配置，请检查 JSON 与文件权限"); }
  return { mode, tokens, host: env.HARNESS_HOST ?? "127.0.0.1", origin: env.HARNESS_ORIGIN,
    maxConcurrent: Number(env.HARNESS_MAX_CONCURRENT ?? 1), dailyRuns: Number(env.HARNESS_DAILY_RUNS ?? 20) };
}
export function validateHosting(config: HostingOptions) {
  if (config.mode !== "local" && config.mode !== "hosted") throw new Error("无效部署模式");
  if (config.mode === "local") return;
  const tokens = config.tokens;
  if (!tokens || typeof tokens !== "object" || Array.isArray(tokens) || !Object.keys(tokens).length) throw new Error("hosted 必须配置用户访问令牌");
  const seen = new Set<string>();
  for (const [id, token] of Object.entries(tokens)) {
    assertId(id);
    if (typeof token !== "string" || token.length < 24 || token.length > 512 || !/^[\x21-\x7e]+$/.test(token) || seen.has(token)) throw new Error("访问令牌须为唯一的 24–512 位非空白 ASCII 文本");
    seen.add(token);
  }
  for (const limit of [config.maxConcurrent ?? 1, config.dailyRuns ?? 20]) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("配额必须为正整数");
  }
  if (config.origin && new URL(config.origin).origin !== config.origin) throw new Error("HARNESS_ORIGIN 须为完整站点源");
}
export function authenticate(request: IncomingMessage, config: HostingOptions) {
  const auth = request.headers.authorization ?? "";
  const supplied = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  for (const [id, token] of Object.entries(config.tokens ?? {})) {
    const a = Buffer.from(supplied), b = Buffer.from(token);
    if (a.length === b.length && timingSafeEqual(a, b)) return id;
  }
  throw new HttpError(401, "请填写有效的访问令牌后连接");
}

/** 先处理结构中的字符串，再序列化，兼容 JSON 内的转义路径与 Windows 路径。 */
export function publicData(data: unknown, root: string, tokens: string[] = []): unknown {
  if (typeof data === "string") {
    // 工具结果可能本身就是一层 JSON 文本，先还原再递归，避免转义路径漏过。
    if (/^\s*[\[{]/.test(data)) {
      try { return JSON.stringify(publicData(JSON.parse(data), root, tokens)); } catch { /* 普通文本继续处理。 */ }
    }
    let text = data;
    const hidden = [...tokens, resolve(root)].flatMap(value => [value, JSON.stringify(value).slice(1, -1)]);
    for (const secret of hidden.sort((a, b) => b.length - a.length)) text = text.split(secret).join("[已隐藏]");
    return text.replace(/file:\/\/[^\s"<>]+/g, "[路径已隐藏]").replace(/(^|[\s"'=(:])(?:[a-zA-Z]:[\\/]|\/(?!\/))[^\s"'<>，；）)\]}]*/g, "$1[路径已隐藏]");
  }
  if (Array.isArray(data)) return data.map(value => publicData(value, root, tokens));
  if (data && typeof data === "object") return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, publicData(value, root, tokens)]));
  return data;
}
interface DayUsage {
  day: string;
  runs: number;
  stages: Partial<Record<Stage, { runs: number; tokens: number; usage_unknown: number }>>;
}
/** 单服务进程的同步预占；日计数落盘，启动失败和中断也占一次。日期按 UTC。 */
export class TenantQuota {
  private active = 0;
  private root: string;
  constructor(private packageRoot: string, private userId: string, private limits: HostingOptions) {
    this.root = tenantRoot(packageRoot, userId);
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
  }
  private path(name: string) { tenantRoot(this.packageRoot, this.userId); return containedPath(this.root, name); }
  snapshot(): DayUsage & { active: number; max_concurrent: number; daily_limit: number } {
    let saved: DayUsage | undefined;
    try { saved = JSON.parse(readFileSync(this.path("quota.json"), "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const day = new Date().toISOString().slice(0, 10);
    const value = saved?.day === day ? saved : { day, runs: 0, stages: {} };
    return { ...value, active: this.active, max_concurrent: this.limits.maxConcurrent ?? 1, daily_limit: this.limits.dailyRuns ?? 20 };
  }
  private save(value: DayUsage) {
    writeFileSync(this.path("quota.json.tmp"), JSON.stringify({ day: value.day, runs: value.runs, stages: value.stages }) + "\n", { mode: 0o600 });
    renameSync(this.path("quota.json.tmp"), this.path("quota.json"));
  }
  reserve(projectId: string, stage: Stage) {
    const value = this.snapshot();
    const reason = value.active >= value.max_concurrent ? "已达到每用户并发运行上限，请等待运行结束" : value.runs >= value.daily_limit ? "已达到今日运行次数上限，请在 UTC 次日重试" : null;
    if (reason) {
      appendFileSync(this.path("quota-audit.jsonl"), JSON.stringify({ actor: this.userId, action: "quota_denied", at: new Date().toISOString(), project_id: projectId, stage, reason }) + "\n", { mode: 0o600 });
      throw new HttpError(429, reason);
    }
    value.runs++;
    (value.stages[stage] ??= { runs: 0, tokens: 0, usage_unknown: 0 }).runs++;
    this.save(value);
    this.active++;
    const day = value.day;
    let released = false;
    return (result?: RunOutcome) => {
      if (released) return;
      released = true; this.active--;
      const current = this.snapshot();
      // 跨日完成的运行仍归启动日；新一天只保留当日统计。
      if (current.day !== day) return;
      const summary = current.stages[stage]!;
      if (result?.usage) summary.tokens += result.usage.totalTokens;
      else summary.usage_unknown++;
      this.save(current);
    };
  }
}
