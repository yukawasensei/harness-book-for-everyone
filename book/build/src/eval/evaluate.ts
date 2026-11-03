import { boardInput } from "../contracts/board.js";
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { STAGES, type Stage } from '../contracts/index.js';
import { ProjectStore } from '../project/store.js';
import { createStageSession } from '../agent/session.js';
import { runStage } from '../agent/run.js';
import { configuredModel, scrubSecrets } from '../agent/model.js';
import { fakeStream, type Turn } from '../testing/fake-model.js';
import type { EvalCase, Result } from './report.js';

/** 固定输出只用于离线机制验证，仍调用真实工具、暂存、版本与闸门。 */
function fakeTurns(root: string, stage: Stage): Turn[] {
  const artifact = JSON.parse(readFileSync(join(root, 'evals/fixtures', `${stage}.json`), 'utf8'));
  if (stage === 'script') return [
    { call: 'write_scene', args: { scene: {} } },
    ...artifact.scenes.map((scene: any) => ({ call: 'write_scene', args: { scene } })),
    { call: 'finalize_draft', args: {} }, { text: '完成，等待人审' },
  ];
  if (stage === 'board') {
    const artifactInput = boardInput(artifact);
    return [
    { call: 'write_scene_shots', args: { scene: {} } },
    ...[...new Set<string>(artifactInput.shots.map((s: any) => s.scene_id))].map(scene_id => ({ call: 'write_scene_shots', args: { scene: { scene_id, shots: artifactInput.shots.filter((s: any) => s.scene_id === scene_id) } } })),
    { call: 'finalize_draft', args: {} }, { text: '完成，等待人审' },
  ];
  }
  return [{ call: 'write_draft', args: { artifact: {} } }, { call: 'write_draft', args: { artifact } }, { text: '完成，等待人审' }];
}
export async function evaluateCase(root: string, outputRoot: string, spec: EvalCase, fake: boolean, options: { turns?: Turn[]; timeoutMs?: number; waitForAbort?: boolean } = {}): Promise<Result> {
  const store = new ProjectStore(outputRoot), project = store.create(spec.id);
  const started = Date.now();
  const base: Result = { id: spec.id, stage: spec.stage, pass: false, completed: false, version: null,
    stop_reason: 'runtime_error', turns: 0, max_turns: spec.max_turns, duration_ms: 0, tool_calls: 0, rejected_calls: 0, coerced_args: 0, errors: [], project: relative(outputRoot, store.projectDir(project.id)) };
  let session: Awaited<ReturnType<typeof createStageSession>> | undefined;
  try {
    for (const stage of STAGES.slice(0, STAGES.indexOf(spec.stage))) {
      const artifact = JSON.parse(readFileSync(join(root, 'evals/fixtures', spec.fixtures[stage]!), 'utf8'));
      store.adopt(project.id, stage, store.writeDraft(project.id, stage, artifact));
    }
    session = await createStageSession({ root, store, projectId: project.id, stage: spec.stage,
      model: fake ? { provider: 'ollama', id: 'qwen3.8:27b' } : configuredModel(root) });
    if (fake) session.agent.streamFunction = fakeStream(session.model!, options.turns ?? fakeTurns(root, spec.stage), { waitForAbort: options.waitForAbort }).fn;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 600_000);
    let result;
    try { result = await runStage(session, store, project.id, spec.stage, spec.instructions, controller.signal); }
    finally { clearTimeout(timer); }
    Object.assign(base, result, { max_turns: spec.max_turns });
    if (controller.signal.aborted) base.stop_reason = 'timeout';
    const versions = store.load(project.id).stages[spec.stage].versions;
    if (versions.length) {
      base.version = versions.at(-1)!;
      // readVersion 会重跑本阶段 schema、业务规则、跨产物引用与精确注入闸门。
      store.readVersion(project.id, spec.stage, base.version);
      base.completed = true;
    }
    base.pass = base.completed && base.stop_reason === 'draft_written' && base.turns <= spec.max_turns && !!base.usage;
  } catch (error) { base.errors.push(scrubSecrets(String(error))); }
  finally { session?.dispose(); }
  base.duration_ms = Date.now() - started;
  return base;
}
