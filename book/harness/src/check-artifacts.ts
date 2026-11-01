// Ch10 · 产物验收：trace 证明“过程守规矩”，产物检查证明“交付的东西对”。两者都绿才算过。
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { TraceRow } from "./trace.js";

export type ArtifactSpec = {
  path: string;
  /** JSON 产物必须有的顶层字段。 */
  json_keys?: string[];
  /** JSON 产物里数组字段的最少条数，例如 { "shots": 3 }。 */
  min_items?: Record<string, number>;
  /** 数组里每一项必须有的字段，例如 { "shots": ["shot_id", "description"] }。 */
  item_keys?: Record<string, string[]>;
  /** Markdown 产物必须出现的标题行。 */
  headings?: string[];
};

export function checkArtifact(root: string, spec: ArtifactSpec): string[] {
  const file = resolve(root, spec.path);
  if (!existsSync(file)) return [`${spec.path} missing`];
  const text = readFileSync(file, "utf8");
  const reasons: string[] = [];
  for (const heading of spec.headings ?? []) {
    if (!text.split("\n").some((line) => line.trim() === heading)) reasons.push(`${spec.path} missing heading "${heading}"`);
  }
  if (spec.json_keys || spec.min_items || spec.item_keys) {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      return [...reasons, `${spec.path} is not valid JSON`];
    }
    for (const key of spec.json_keys ?? []) if (!(key in data)) reasons.push(`${spec.path} missing key "${key}"`);
    for (const [key, min] of Object.entries(spec.min_items ?? {})) {
      const items = data[key];
      if (!Array.isArray(items) || items.length < min) reasons.push(`${spec.path} ${key} has ${Array.isArray(items) ? items.length : 0} items, expected >= ${min}`);
    }
    for (const [key, fields] of Object.entries(spec.item_keys ?? {})) {
      const items = Array.isArray(data[key]) ? (data[key] as Record<string, unknown>[]) : [];
      items.forEach((item, i) => {
        for (const f of fields) if (!item || typeof item !== "object" || !(f in item)) reasons.push(`${spec.path} ${key}[${i}] missing "${f}"`);
      });
    }
  }
  return reasons;
}

/** 成功写入的路径，按发生顺序。 */
export function successfulWrites(rows: TraceRow[]): string[] {
  const ok = new Set(rows.filter((r) => r.eventType === "tool_execution_end" && r.isError === false).map((r) => String(r.toolCallId)));
  return rows
    .filter((r) => r.eventType === "tool_execution_start" && r.toolName === "write" && ok.has(String(r.toolCallId)))
    .map((r) => String((r.args as { path?: string } | undefined)?.path ?? ""));
}

/** 每个路径第一次写入的先后必须符合 order（允许中间重写同一文件）。 */
export function checkWriteOrder(rows: TraceRow[], order: string[]): string[] {
  const writes = successfulWrites(rows);
  const firsts = order.map((p) => writes.indexOf(p));
  if (firsts.some((i) => i < 0)) return [`write order: missing ${order.filter((_, k) => firsts[k] < 0).join(",")}`];
  for (let k = 1; k < firsts.length; k += 1) {
    if (firsts[k] < firsts[k - 1]) return [`write order: ${order[k]} written before ${order[k - 1]}`];
  }
  return [];
}
