import { randomUUID } from "node:crypto";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { STAGES, type Stage } from "../contracts/index.js";
import type { ProjectStore } from "../project/store.js";
import { createStageSession, type StageSessionOptions } from "../agent/session.js";
import { runStage } from "../agent/run.js";
import { stagePrompt } from "../agent/prompts.js";
import { scrubSecrets } from "../agent/model.js";
import { assertRunnable } from "../workflow/index.js";
import type { ProjectEvents } from "./events.js";
import { HttpError, validation } from "./http.js";
import type { ProjectDetail, RunInfo, RunResult, RunOutcome } from "./protocol.js";
import type { ResumeChoice } from "../project/checkpoints.js";

type ReleaseRun = (result?: RunOutcome) => void;
export type SessionFactory = (options: StageSessionOptions) => Promise<AgentSession>;
interface ActiveRun {
  info: RunInfo;
  controller: AbortController;
  done: Promise<void>;
  finish: () => void;
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
  ) { this.store.recoverInterruptedRuns(); }

  detail(id: string): ProjectDetail {
    const project = this.store.load(id);
    const reasons = Object.fromEntries(STAGES.map(stage => {
      try { assertRunnable(project.stages, stage); stagePrompt(stage); return [stage, null]; }
      catch (error) { return [stage, error instanceof Error ? error.message : "阶段不可运行"]; }
    })) as Record<Stage, string | null>;
    const staging = Object.fromEntries(STAGES.map(stage => {
      const saved = this.store.readStaging(id, stage);
      return [stage, saved?.snapshot.finalized_version === null ? {
        count: (saved.snapshot.scenes ?? saved.snapshot.items ?? []).length,
        revise_from: (saved.snapshot.scene_changes ?? saved.snapshot.shot_changes)?.revise_from ?? null,
        based_on: saved.based_on,
      } : null];
    })) as ProjectDetail["staging"];
    return { ...project, staging, bible_impact: this.store.bibleImpact(id), reassemble_reason: this.store.reassembleReason(id), running: this.active.get(id)?.info ?? null, last_run: this.last.get(id) ?? this.store.lastInterruptedRun(id), run_blocked_reasons: reasons };
  }

  notify(id: string) { this.events.publish(id, { type: "project_state", project: this.detail(id) }); }

  assertIdle(id: string) {
    if (this.active.has(id)) throw new HttpError(409, "项目已有运行中的阶段；请等待结束或中断后再操作");
  }

  async start(id: string, stage: Stage, instructions: string, reviseFrom?: number, options: { confirmed?: boolean; staging?: ResumeChoice } = {}): Promise<RunInfo> {
    if (this.closing) throw new HttpError(503, "服务正在关闭");
    this.assertIdle(id);
    validation(() => {
      assertRunnable(this.store.load(id).stages, stage); stagePrompt(stage);
      if (this.store.load(id).stages[stage].adopted_version !== null && !options.confirmed) throw new Error("已采用阶段再次运行需要二次确认");
      const saved = ["script", "storyboard", "prompts"].includes(stage) ? this.store.readStaging(id, stage) : null;
      if (saved?.snapshot.finalized_version === null && !options.staging) throw new Error("存在暂存，请选择从暂存继续或重新开始");
      if (options.staging === "resume") this.store.assertStagingCurrent(id, stage, reviseFrom);
      if (reviseFrom !== undefined) this.store.revisionContext(id, stage, reviseFrom);
    });
    const release = this.reserve?.(id, stage);
    let finish!: () => void;
    const run: ActiveRun = {
      info: { id: randomUUID(), stage, started_at: new Date().toISOString(), abort_requested: false },
      controller: new AbortController(), done: new Promise<void>(resolve => { finish = resolve; }), finish: () => finish(),
    };
    // 在第一次 await 之前占位，创建会话期间也拒绝重复运行与采用。
    try { this.store.saveRunLock(id, run.info); }
    catch (error) { release?.(); throw error; }
    this.active.set(id, run);
    let session: AgentSession;
    try { session = await this.sessionFactory({ root: this.root, store: this.store, projectId: id, stage, reviseFrom, staging: options.staging }); }
    catch (error) {
      this.active.delete(id);
      try { release?.(); this.store.finishRunLock(id); }
      finally { run.finish(); }
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
      const ids = saved.snapshot.items?.map(item => item.shot_id) ?? saved.snapshot.scenes?.map(scene => scene.scene_id) ?? [];
      this.events.publish(id, { type: "staging_restored", stage, run_id: run.info.id, ids, unit: stage === "prompts" ? "镜" : "场" });
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
