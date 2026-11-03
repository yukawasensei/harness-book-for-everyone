import { randomUUID } from "node:crypto";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { STAGES, type Stage } from "../contracts/index.js";
import type { ProjectStore } from "../project/store.js";
import { createStageSession, type StageSessionOptions } from "../agent/session.js";
import { runStage } from "../agent/run.js";
import { stagePrompt } from "../agent/prompts.js";
import { scrubSecrets } from "../agent/model.js";
import { assertRunnable, reviewOf } from "../workflow/index.js";
import type { ProjectEvents } from "./events.js";
import { HttpError, validation } from "./http.js";
import type { MessageResponse, ProjectDetail, RunInfo, RunResult, RunOutcome } from "./protocol.js";
import type { ResumeChoice } from "../project/checkpoints.js";
import { ProjectTimeline } from "./timeline.js";

const stageNames: Record<Stage, string> = { story: "故事", script: "剧本", bible: "设定集", board: "分镜板" };
function pendingVersion(state: ReturnType<ProjectStore["load"]>["stages"][Stage]) {
  return [...state.versions].reverse().find(v => v > (state.adopted_version ?? 0) && reviewOf(state, v).status === "pending");
}

type ReleaseRun = (result?: RunOutcome) => void;
export type SessionFactory = (options: StageSessionOptions) => Promise<AgentSession>;
interface ActiveRun {
  info: RunInfo;
  controller: AbortController;
  done: Promise<void>;
  finish: () => void;
  beforeVersion: number;
}

/** 锁只覆盖这个服务进程。CLI 与第二个服务进程不共享此锁。 */
export class StageRuns {
  private active = new Map<string, ActiveRun>();
  private last = new Map<string, RunResult>();
  private closing = false;

  constructor(
    private root: string, private store: ProjectStore, private events: ProjectEvents,
    private sessionFactory: SessionFactory = createStageSession,
    private reserve?: (id: string, stage: Stage) => ReleaseRun,
    readonly timeline: ProjectTimeline = new ProjectTimeline(store, events, data => data),
  ) { this.store.recoverInterruptedRuns(); this.timeline.recover(); }

  detail(id: string): ProjectDetail {
    const project = this.store.load(id);
    const reasons = Object.fromEntries(STAGES.map(stage => {
      try { assertRunnable(project.stages, stage); stagePrompt(stage); return [stage, null]; }
      catch (error) { return [stage, error instanceof Error ? error.message : "阶段不可运行"]; }
    })) as Record<Stage, string | null>;
    const staging = Object.fromEntries(STAGES.map(stage => {
      const saved = this.store.readStaging(id, stage);
      return [stage, saved?.snapshot.finalized_version === null ? {
        count: (saved.snapshot.scenes ?? []).length,
        revise_from: saved.snapshot.scene_changes?.revise_from ?? null,
        based_on: saved.based_on,
      } : null];
    })) as ProjectDetail["staging"];
    return { ...project, updated_at: this.store.updatedAt(id), staging, bible_impact: this.store.bibleImpact(id), reassemble_reason: this.store.reassembleReason(id), running: this.active.get(id)?.info ?? null, last_run: this.last.get(id) ?? this.store.lastInterruptedRun(id), run_blocked_reasons: reasons };
  }

  notify(id: string) { this.events.publish(id, { type: "project_state", project: this.detail(id) }); }

  assertIdle(id: string) {
    const active = this.active.get(id);
    if (active) throw new HttpError(409, `正在写${stageNames[active.info.stage]}，请等它完成或点中断`);
  }

  private nextStage(id: string, stale = false): Stage | undefined {
    const project = this.store.load(id);
    return STAGES.find(stage => {
      if (project.stages[stage].status !== (stale ? "stale" : "ready")) return false;
      try { assertRunnable(project.stages, stage); stagePrompt(stage); return true; } catch { return false; }
    });
  }

  async message(id: string, text: string): Promise<MessageResponse> {
    if (this.active.has(id)) {
      this.store.auditAction(id, "message_routed", { rule: 1, action_taken: "busy" });
      this.assertIdle(id);
    }
    const item = this.timeline.add(id, { kind: "user_message", text });
    const project = this.store.load(id);
    const pendingStage = STAGES.find(stage => pendingVersion(project.stages[stage]) !== undefined);
    const stage = pendingStage ?? this.nextStage(id) ?? this.nextStage(id, true);
    const stale = stage !== undefined && project.stages[stage].status === "stale";
    const action = pendingStage ? "revise" : stage ? "run" : "none";
    const rule = pendingStage && !stale ? 2 : stage && !stale ? 3 : STAGES.every(s => project.stages[s].status === "adopted") ? 4 : 5;
    this.store.auditAction(id, "message_routed", { rule, action_taken: action, ...(stage ? { stage } : {}) });
    if (!stage) {
      this.timeline.add(id, { kind: "assistant_note", text: rule === 4 ? "全流程已完成，可在右侧查看或对某一阶段返工" : "请先处理上游待更新内容，再继续运行。" });
      return { action: "none", item };
    }
    if (stale) this.timeline.add(id, { kind: "assistant_note", text: `${stageNames[stage]}待更新，将把本条消息作为重跑要求。` });
    let reviseFrom: number | undefined;
    if (pendingStage) {
      const version = pendingVersion(project.stages[stage])!;
      reviseFrom = version;
      validation(() => this.store.requestChanges(id, stage, version, text));
      this.timeline.add(id, { kind: "review_decision", stage, version, decision: "changes_requested", note: text });
    }
    try {
      const run = await this.start(id, stage, text, reviseFrom, { confirmed: stale || project.stages[stage].adopted_version !== null, staging: "restart" });
      return { action, item, run };
    } catch (error) {
      this.timeline.add(id, { kind: "assistant_note", text: error instanceof HttpError ? error.message : "未能启动，请检查服务端运行记录。" });
      throw error;
    }
  }

  async autoAdvance(id: string, adoptedStage: Stage) {
    if (this.active.has(id) || this.closing) return;
    const project = this.store.load(id);
    // 有任何待审稿时仍需人先签字；一次采用最多启动一道。
    if (Object.values(project.stages).some(state => pendingVersion(state) !== undefined)) return;
    const stage = STAGES[STAGES.indexOf(adoptedStage) + 1];
    // 历史换版后的 stale 下游必须显式返工，不跳过下一道去扫描别处。
    if (!stage || project.stages[stage].status !== "ready" || project.stages[stage].adopted_version !== null) return;
    try {
      await this.start(id, stage, "", undefined, { autoAfter: adoptedStage });
    } catch (error) {
      const reason = error instanceof HttpError ? error.message : "启动失败，请检查服务端运行记录";
      this.timeline.add(id, { kind: "assistant_note", text: `自动推进已停下：${reason}` });
      this.store.auditAction(id, "auto_stopped", { stage, reason });
    }
  }

  async start(id: string, stage: Stage, instructions: string, reviseFrom?: number, options: { confirmed?: boolean; staging?: ResumeChoice; autoAfter?: Stage } = {}): Promise<RunInfo> {
    if (this.closing) throw new HttpError(503, "服务正在关闭");
    this.assertIdle(id);
    validation(() => {
      assertRunnable(this.store.load(id).stages, stage); stagePrompt(stage);
      if (this.store.load(id).stages[stage].adopted_version !== null && !options.confirmed) throw new Error("已采用阶段再次运行需要二次确认");
      const saved = ["script", "board"].includes(stage) ? this.store.readStaging(id, stage) : null;
      if (saved?.snapshot.finalized_version === null && !options.staging) throw new Error("存在暂存，请选择从暂存继续或重新开始");
      if (options.staging === "resume") this.store.assertStagingCurrent(id, stage, reviseFrom);
      if (reviseFrom !== undefined) this.store.revisionContext(id, stage, reviseFrom);
    });
    const release = this.reserve?.(id, stage);
    let finish!: () => void;
    const run: ActiveRun = {
      info: { id: randomUUID(), stage, started_at: new Date().toISOString(), abort_requested: false },
      controller: new AbortController(), done: new Promise<void>(resolve => { finish = resolve; }), finish: () => finish(),
      beforeVersion: this.store.load(id).stages[stage].versions.at(-1) ?? 0,
    };
    // 在第一次 await 之前占位，创建会话期间也拒绝重复运行与采用。
    try {
      this.store.saveRunLock(id, run.info);
      this.active.set(id, run);
      if (options.autoAfter) {
        this.timeline.add(id, { kind: "assistant_note", text: `${stageNames[options.autoAfter]}已采用，开始写${stageNames[stage]}` });
        this.store.auditAction(id, "auto_started", { stage, run_id: run.info.id, after: options.autoAfter });
      }
      this.timeline.add(id, { kind: "run", run_id: run.info.id, stage, status: "running", ...(reviseFrom === undefined ? {} : { revise_from: reviseFrom }) });
    } catch (error) {
      const locked = this.active.delete(id);
      try { release?.(); if (locked) this.store.finishRunLock(id); }
      finally { run.finish(); }
      throw error;
    }
    let session: AgentSession;
    try {
      session = await this.sessionFactory({ root: this.root, store: this.store, projectId: id, stage, reviseFrom, staging: options.staging });
      session.sessionManager.appendCustomEntry("web_run", { run_id: run.info.id, stage });
    }
    catch (error) {
      this.active.delete(id);
      try { release?.(); this.store.finishRunLock(id); }
      finally { run.finish(); }
      this.last.set(id, { ...run.info, stop_reason: "runtime_error", errors: ["会话初始化失败"] });
      this.timeline.updateRun(id, run.info.id, { status: "failed", stop_reason: "runtime_error" });
      this.timeline.add(id, { kind: "assistant_note", text: `${stageNames[stage]}运行失败，已停下：会话初始化失败，请检查模型配置或服务端记录。` });
      this.notify(id);
      if (error instanceof Error && !("code" in error)) throw new HttpError(422, scrubSecrets(error.message));
      throw error;
    }
    const unsubscribe = session.subscribe(event => {
      const context = { stage, run_id: run.info.id };
      switch (event.type) {
        case "agent_start": case "agent_end":
          this.events.publish(id, { type: event.type, ...context });
          break;
        case "message_update":
          if (event.assistantMessageEvent.type === "text_delta") {
            const { type, delta, contentIndex } = event.assistantMessageEvent;
            this.events.publish(id, { type: event.type, assistantMessageEvent: { type, delta, contentIndex }, ...context });
          }
          break;
        case "tool_execution_start":
          this.events.publish(id, { type: event.type, toolCallId: event.toolCallId, toolName: event.toolName, args: event.args, ...context });
          break;
        case "tool_execution_update":
          this.events.publish(id, { type: event.type, toolCallId: event.toolCallId, toolName: event.toolName, partialResult: event.partialResult, ...context });
          break;
        case "tool_execution_end":
          this.events.publish(id, { type: event.type, toolCallId: event.toolCallId, toolName: event.toolName, result: event.result, isError: event.isError, ...context });
          if (["write_draft", "finalize_draft"].includes(event.toolName) && !event.isError) this.notify(id);
          break;
      }
    });
    this.events.publish(id, { type: "run_started", run: run.info });
    if (options.staging === "resume") {
      const saved = this.store.assertStagingCurrent(id, stage, reviseFrom);
      const ids = saved.snapshot.scenes?.map(scene => scene.scene_id) ?? [];
      this.events.publish(id, { type: "staging_restored", stage, run_id: run.info.id, ids, unit: "场" });
    }
    this.notify(id);
    void this.execute(id, session, run, instructions, unsubscribe, reviseFrom, options, release).catch(() => {
      console.error("运行收尾写入失败，请检查服务器存储与会话记录");
    });
    return run.info;
  }

  private async execute(id: string, session: AgentSession, run: ActiveRun, instructions: string, unsubscribe: () => void, reviseFrom?: number, options: { confirmed?: boolean; staging?: ResumeChoice } = {}, release?: ReleaseRun) {
    let result: RunOutcome;
    try { result = await runStage(session, this.store, id, run.info.stage, instructions, run.controller.signal, reviseFrom, options); }
    catch { result = { stop_reason: "runtime_error", errors: ["运行异常，请检查本地会话记录"] }; }
    finally { unsubscribe(); session.dispose(); }
    try {
      release?.(result);
      const summary: RunResult = { ...run.info, ...result };
      this.last.set(id, summary);
      this.store.finishRunLock(id);
      this.active.delete(id);
      const versions = this.store.load(id).stages[run.info.stage].versions.filter(v => v > run.beforeVersion);
      this.timeline.updateRun(id, run.info.id, {
        status: ["aborted", "interrupted"].includes(result.stop_reason) ? "interrupted" : result.stop_reason === "draft_written" ? "done" : "failed",
        stop_reason: result.stop_reason, ...(versions.length ? { version: versions.at(-1) } : {}),
      });
      for (const version of versions) this.timeline.add(id, { kind: "review_request", stage: run.info.stage, version });
      if (result.stop_reason !== "draft_written") this.timeline.add(id, { kind: "assistant_note", text: `${stageNames[run.info.stage]}运行${result.stop_reason === "aborted" ? "已中断" : "失败"}，已停下。请检查运行记录后重试。` });
      this.events.publish(id, { type: "run_ended", run: summary });
      this.notify(id);
    } finally { this.active.delete(id); run.finish(); }
  }

  abort(id: string): RunInfo {
    const run = this.active.get(id);
    if (!run) throw new HttpError(409, "项目没有运行中的阶段");
    run.info.abort_requested = true;
    run.controller.abort();
    this.notify(id);
    return run.info;
  }

  async close() {
    this.closing = true;
    const runs = [...this.active.values()];
    for (const run of runs) { run.info.abort_requested = true; run.controller.abort(); }
    await Promise.all(runs.map(run => run.done));
  }
}
