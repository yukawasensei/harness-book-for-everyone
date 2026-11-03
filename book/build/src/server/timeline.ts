import { randomUUID } from "node:crypto";
import { STAGES } from "../contracts/index.js";
import type { ProjectStore } from "../project/store.js";
import type { ProjectEvents } from "./events.js";
import type { TimelineItem, TranscriptItem } from "./protocol.js";

type NewItem = TimelineItem extends infer Item ? Item extends TimelineItem ? Omit<Item, "id" | "at"> : never : never;
const labels: Record<string, string> = {
  read_upstream: "读取上游产物", write_draft: "提交草稿", write_scene: "提交单场剧本",
  remove_scene: "删除场次", write_scene_shots: "提交单场分镜", remove_scene_shots: "删除单场分镜",
  finalize_draft: "汇总草稿",
};
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** 只挑 assistant 文本与工具调用；custom 中的系统提示、用户提示和上下文均不出站。 */
export function restoreTranscript(entries: Record<string, unknown>[], clean: (data: unknown) => unknown): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  const calls = new Map<string, Extract<TranscriptItem, { type: "tool" }>>();
  for (const entry of entries) {
    if (entry.type !== "message") continue;
    const message = record(entry.message);
    const content = Array.isArray(message.content) ? message.content.map(record) : [];
    if (message.role === "assistant") {
      for (const part of content) {
        if (part.type === "text" && typeof part.text === "string") items.push({ type: "text", text: part.text });
        if (part.type === "toolCall" && typeof part.name === "string" && typeof part.id === "string") {
          const tool: Extract<TranscriptItem, { type: "tool" }> = {
            type: "tool", name: part.name, label: labels[part.name] ?? "工具调用",
            args_summary: JSON.stringify(clean(part.arguments ?? {})).slice(0, 800), ok: false,
          };
          calls.set(part.id, tool); items.push(tool);
        }
      }
    } else if (message.role === "toolResult") {
      const tool = calls.get(String(message.toolCallId));
      if (tool) {
        tool.ok = message.isError !== true;
        if (!tool.ok) tool.error = content.filter(p => p.type === "text" && typeof p.text === "string").map(p => p.text).join("\n");
      }
    }
  }
  // 最后再脱敏，避免摘要截断造成已知令牌无法匹配。
  return clean(items) as TranscriptItem[];
}

/** 追加日志以同一 id 更新运行状态；读取时折叠，SSE 客户端也按 id 替换。 */
export class ProjectTimeline {
  constructor(private store: ProjectStore, private events: ProjectEvents, private clean: (data: unknown) => unknown) {}

  private legacy(id: string): TimelineItem[] {
    const project = this.store.load(id), audit = this.store.readAudit(id);
    const items: TimelineItem[] = [];
    for (const stage of STAGES) {
      for (const version of project.stages[stage].versions) {
        const at = this.store.versionTimestamp(id, stage, version);
        items.push({ kind: "review_request", id: `legacy-request-${stage}-${version}`, at, stage, version });
        const decisions = audit.filter(row => row.stage === stage && row.version === version && ["adopted", "discarded", "changes_requested", "switch_adoption"].includes(String(row.action)));
        if (decisions.length) {
          for (const [index, row] of decisions.entries()) items.push({
            kind: "review_decision", id: `legacy-decision-${stage}-${version}-${index}`, at: typeof row.at === "string" ? row.at : at,
            stage, version, decision: row.action === "switch_adoption" ? "adopted" : row.action as "adopted" | "discarded" | "changes_requested",
            ...(typeof row.note === "string" ? { note: row.note } : {}),
          });
        } else {
          const review = project.stages[stage].reviews?.[version];
          if (review && review.status !== "pending") items.push({ kind: "review_decision", id: `legacy-decision-${stage}-${version}`, at: review.at ?? at, stage, version, decision: review.status, ...(review.note ? { note: review.note } : {}) });
        }
      }
    }
    return items.sort((a, b) => a.at.localeCompare(b.at));
  }

  private entries(id: string): TimelineItem[] {
    const folded = new Map<string, TimelineItem>();
    for (const item of this.store.readConversation(id) ?? this.legacy(id)) folded.set(item.id, item);
    return [...folded.values()];
  }

  read(id: string): TimelineItem[] {
    const items = this.entries(id);
    if (items.some(item => item.kind === "run")) {
      const sessions = this.store.readSessions(id);
      for (const item of items) if (item.kind === "run") {
        const entries = sessions.find(entries => entries.some(entry => entry.type === "custom" && entry.customType === "web_run" && record(entry.data).run_id === item.run_id));
        item.transcript = entries ? restoreTranscript(entries, this.clean) : [];
      }
    }
    return this.clean(items) as TimelineItem[];
  }

  add(id: string, input: NewItem): TimelineItem {
    const item = { ...input, id: randomUUID(), at: new Date().toISOString() } as TimelineItem;
    this.write(id, item);
    return this.clean(item) as TimelineItem;
  }

  updateRun(id: string, runId: string, fields: Partial<Extract<TimelineItem, { kind: "run" }>>) {
    const item = this.entries(id).find(item => item.kind === "run" && item.run_id === runId);
    if (!item || item.kind !== "run") return;
    this.write(id, { ...item, ...fields, kind: "run", id: item.id, run_id: runId });
  }

  private write(id: string, item: TimelineItem) {
    const seed = this.store.readConversation(id) === null ? this.legacy(id) : [];
    this.store.appendConversation(id, [...seed, item]);
    this.events.publish(id, { type: "timeline_item", item: this.clean(item) as TimelineItem });
  }

  recover() {
    for (const project of this.store.list()) {
      if (this.store.readConversation(project.id) === null) continue;
      for (const item of this.entries(project.id)) if (item.kind === "run" && item.status === "running") {
        this.updateRun(project.id, item.run_id, { status: "interrupted", stop_reason: "interrupted" });
        this.add(project.id, { kind: "assistant_note", text: "服务重启，上次运行已中断，请重新发消息或从暂存继续。" });
      }
    }
  }
}
