import { readableError, readerMessage, toolErrorText } from "@/features/artifacts";
import type { TimelineRow } from "./append-event.js";

const DRAFT_TOOLS = new Set(["write_draft", "finalize_draft", "write_scene_shots", "remove_scene_shots"]);
const SCENE_TOOLS = new Set(["write_scene_shots", "remove_scene_shots"]);

export type TranscriptLike =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; label?: string; args_summary?: string; ok: boolean; error?: string };

export type FoldSegment<T> =
  | { kind: "plain"; items: T[] }
  | { kind: "self_correction"; reason: string; items: T[] };

function draftReason(error: string | undefined): string {
  if (!error?.trim()) return "格式检查未通过";
  return readerMessage(readableError(error));
}

/** 从工具参数或 args_summary 中取出场次编号（分镜板按场归组）。 */
export function extractSceneId(args: unknown): string | undefined {
  if (args == null || args === "") return undefined;
  let record: Record<string, unknown> | null = null;
  if (typeof args === "string") {
    try {
      const parsed = JSON.parse(args) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) record = parsed as Record<string, unknown>;
    } catch {
      const match = args.match(/"scene_id"\s*:\s*"([^"]+)"/) ?? args.match(/\bscene_id\s*:\s*([A-Za-z0-9_]+)/);
      return match?.[1];
    }
  } else if (typeof args === "object" && !Array.isArray(args)) {
    record = args as Record<string, unknown>;
  }
  if (!record) return undefined;
  if (typeof record.scene_id === "string" && record.scene_id.trim()) return record.scene_id;
  const scene = record.scene;
  if (scene && typeof scene === "object" && !Array.isArray(scene)) {
    const id = (scene as Record<string, unknown>).scene_id;
    if (typeof id === "string" && id.trim()) return id;
  }
  return undefined;
}

function groupKey(name: string, args: unknown): string {
  if (SCENE_TOOLS.has(name)) {
    const sceneId = extractSceneId(args);
    return sceneId ? `${name}:${sceneId}` : name;
  }
  return "draft";
}

function foldByDraftIndexes<T>(
  items: T[],
  draftIndexes: number[],
  isFail: (index: number) => boolean,
  isSuccess: (index: number) => boolean,
  reasonAt: (index: number) => string,
  keyAt: (index: number) => string,
): FoldSegment<T>[] {
  for (const firstFail of draftIndexes) {
    if (!isFail(firstFail)) continue;
    const failKey = keyAt(firstFail);
    const successAfter = draftIndexes.find(index => {
      if (index <= firstFail || !isSuccess(index) || keyAt(index) !== failKey) return false;
      return draftIndexes
        .filter(i => i > firstFail && i < index)
        .every(i => keyAt(i) === failKey);
    });
    if (successAfter === undefined) continue;

    const segments: FoldSegment<T>[] = [];
    if (firstFail > 0) segments.push({ kind: "plain", items: items.slice(0, firstFail) });
    segments.push({ kind: "self_correction", reason: reasonAt(firstFail), items: items.slice(firstFail, successAfter + 1) });
    if (successAfter + 1 < items.length) {
      const rest = items.slice(successAfter + 1);
      const restDraftIndexes = rest
        .map((_, offset) => offset)
        .filter(offset => draftIndexes.includes(offset + successAfter + 1));
      segments.push(...foldByDraftIndexes(
        rest,
        restDraftIndexes,
        index => isFail(index + successAfter + 1),
        index => isSuccess(index + successAfter + 1),
        index => reasonAt(index + successAfter + 1),
        index => keyAt(index + successAfter + 1),
      ));
    }
    return segments;
  }
  return [{ kind: "plain", items }];
}

/** 将首次提交失败、随后成功的草稿工具调用收进自我修正折叠段。 */
export function foldSelfCorrectionTranscript(items: TranscriptLike[]): FoldSegment<TranscriptLike>[] {
  const draftIndexes = items
    .map((item, index) => (item.type === "tool" && DRAFT_TOOLS.has(item.name) ? index : -1))
    .filter(index => index >= 0);
  return foldByDraftIndexes(
    items,
    draftIndexes,
    index => {
      const item = items[index];
      return item.type === "tool" && !item.ok;
    },
    index => {
      const item = items[index];
      return item.type === "tool" && item.ok;
    },
    index => {
      const item = items[index];
      return item.type === "tool" ? draftReason(item.error) : "格式检查未通过";
    },
    index => {
      const item = items[index];
      return item.type === "tool" ? groupKey(item.name, item.args_summary) : "draft";
    },
  );
}

/** 实时行：失败草稿工具后出现成功草稿工具时，把中间内容一并折叠。 */
export function foldSelfCorrectionLiveRows(rows: TimelineRow[]): FoldSegment<TimelineRow>[] {
  const draftIndexes = rows
    .map((row, index) => (row.kind === "tool" && DRAFT_TOOLS.has(row.name) ? index : -1))
    .filter(index => index >= 0);
  return foldByDraftIndexes(
    rows,
    draftIndexes,
    index => {
      const row = rows[index];
      return row.kind === "tool" && row.status === "error";
    },
    index => {
      const row = rows[index];
      return row.kind === "tool" && row.status === "success";
    },
    index => {
      const row = rows[index];
      if (row.kind !== "tool") return "格式检查未通过";
      if (row.result !== undefined) return toolErrorText(row.result);
      return "格式检查未通过";
    },
    index => {
      const row = rows[index];
      return row.kind === "tool" ? groupKey(row.name, row.args) : "draft";
    },
  );
}
