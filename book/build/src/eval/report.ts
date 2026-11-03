import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STAGES, parseStage, validateArtifact, type Stage } from '../contracts/index.js';
import { STAGE_TURN_LIMITS } from '../agent/run.js';
import { sumUsage } from './usage.js';
import type { Usage } from '@earendil-works/pi-ai';
import { isDeepStrictEqual } from 'node:util';
import { DEFAULT_MODEL } from '../agent/model.js';

/** 四工序观察与旧六工序及五工序过渡基线隔离。 */
export const PIPELINE_VERSION = 'reelloom-4stage-v1';
export const BASELINE_FILE = 'evals/baselines/4stage-v1.json';

export interface EvalCase { id: string; stage: Stage; fixtures: Partial<Record<Stage, string>>; max_turns: number; instructions: string }
export function loadCases(root: string, input: unknown = JSON.parse(readFileSync(join(root, 'evals/cases.json'), 'utf8'))): EvalCase[] {
  if (!Array.isArray(input) || !input.length) throw new Error('cases 必须是非空数组');
  const ids = new Set<string>();
  for (const c of input) {
    if (!c || typeof c.id !== 'string' || !/^[a-z0-9-]+$/.test(c.id) || ids.has(c.id)) throw new Error('case ID 不合法或重复');
    ids.add(c.id); parseStage(c.stage);
    if (!Number.isSafeInteger(c.max_turns) || c.max_turns < 1 || c.max_turns > STAGE_TURN_LIMITS[c.stage as Stage]) throw new Error('case 轮数预算不合规');
    if (typeof c.instructions !== 'string' || !c.instructions.trim()) throw new Error('case 缺少说明');
    const upstream = STAGES.slice(0, STAGES.indexOf(c.stage));
    if (!c.fixtures || typeof c.fixtures !== 'object' || Array.isArray(c.fixtures) || Object.keys(c.fixtures).length !== upstream.length || Object.keys(c.fixtures).some(key => !upstream.includes(key as Stage))) throw new Error('case 需要固定的全部上游夹具');
    for (const stage of upstream) {
      const file = c.fixtures[stage];
      if (typeof file !== 'string' || !/^[a-z0-9-]+\.json$/.test(file)) throw new Error('夹具文件名不合规');
      validateArtifact(stage, JSON.parse(readFileSync(join(root, 'evals/fixtures', file), 'utf8')));
    }
  }
  if (input.length !== STAGES.length || new Set(input.map(c => c.stage)).size !== STAGES.length) throw new Error('全量 cases 必须各覆盖一次四阶段 story/script/bible/board');
  return input;
}
export function parseRepeat(args: string[]) {
  if (!args.length) return 1;
  const value = args.length === 2 && args[0] === '--repeat' ? args[1] : args.length === 1 && args[0].startsWith('--repeat=') ? args[0].slice(9) : '';
  if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('用法：npm run eval -- --repeat N（正整数）');
  return Number(value);
}
export interface Result {
  id: string; stage: Stage; pass: boolean; completed: boolean; version: number | null;
  stop_reason: string; turns: number; max_turns: number; duration_ms: number;
  tool_calls: number; rejected_calls: number; coerced_args?: number; usage?: Usage; errors: string[]; attempt?: number; project?: string;
}
export function summarize(model: string, results: Result[]) {
  const calls = results.reduce((s, r) => s + r.tool_calls, 0);
  const rejected = results.reduce((s, r) => s + r.rejected_calls, 0);
  const cases = [...new Set(results.map(r => r.id))].map(id => {
    const attempts = results.filter(r => r.id === id), passed = attempts.filter(r => r.pass).length;
    return { id, pass: passed === attempts.length, pass_rate: passed / attempts.length, attempts,
      stop_reasons: Object.fromEntries([...new Set(attempts.map(r => r.stop_reason))].map(reason => [reason, attempts.filter(r => r.stop_reason === reason).length])) };
  });
  const by_stage = Object.fromEntries(STAGES.map(stage => {
    const rows = results.filter(r => r.stage === stage);
    return [stage, { attempts: rows.length, duration_ms: rows.reduce((s, r) => s + r.duration_ms, 0), coerced_args: rows.reduce((s, r) => s + (r.coerced_args ?? 0), 0), usage: sumUsage(rows.flatMap(r => r.usage ? [r.usage] : [])) }];
  })) as Record<Stage, { attempts: number; duration_ms: number; coerced_args: number; usage?: Usage }>;
  return { pipeline_version: PIPELINE_VERSION, model, total: results.length, passCount: results.filter(r => r.pass).length, cases, by_stage,
    completion_rate: results.length ? results.filter(r => r.completed).length / results.length : 0,
    coerced_args: results.reduce((s, r) => s + (r.coerced_args ?? 0), 0), coerced_args_unknown: results.filter(r => r.coerced_args === undefined).length, tool_calls: calls, rejected_calls: rejected, rejection_rate: calls ? rejected / calls : 0,
    usage: sumUsage(results.flatMap(r => r.usage ? [r.usage] : [])) };
}
export type Summary = ReturnType<typeof summarize>;
/** 只接受同系列真实全量单轮签收；损坏或伪造的基线在创建运行目录前拒绝。 */
export function assertBaseline(value: unknown, specs: EvalCase[]): asserts value is Summary {
  const b = value as Summary & { fake?: boolean; repeat?: number; case_specs?: EvalCase[] };
  if (!b || b.pipeline_version !== PIPELINE_VERSION || b.model !== DEFAULT_MODEL) throw new Error('基线模型或流水线身份不符');
  if (b.fake !== false || b.repeat !== 1 || !isDeepStrictEqual(b.case_specs, specs)) throw new Error('基线须为真实全量单轮且 case 配置一致；配置变更须建立新流水线系列');
  if (!Array.isArray(b.cases) || b.cases.length !== specs.length || b.total !== specs.length || b.passCount !== specs.length) throw new Error('基线不是完整通过的签收');
  const results: Result[] = [];
  for (const spec of specs) {
    const matches = b.cases.filter(c => c.id === spec.id);
    if (matches.length !== 1) throw new Error('基线 case 缺失或重复');
    const c = matches[0], a = c.attempts?.[0];
    if (!c.pass || c.pass_rate !== 1 || c.attempts?.length !== 1 || !a || a.id !== spec.id || a.stage !== spec.stage || a.attempt !== 1 || !a.pass || !a.completed || !Number.isSafeInteger(a.version) || a.version! < 1 || a.stop_reason !== 'draft_written' || !Number.isSafeInteger(a.turns) || a.turns < 1 || a.turns > spec.max_turns || a.max_turns !== spec.max_turns || !a.usage) throw new Error('基线观察缺失或未正常完成');
    results.push(a);
  }
  const expected = summarize(DEFAULT_MODEL, results);
  if (!isDeepStrictEqual(b.by_stage, expected.by_stage) || b.completion_rate !== 1) throw new Error('基线阶段统计与观察不一致');
}
export function compare(previous: Summary | undefined, current: Summary) {
  if (!previous) return current.cases.map(c => ({ id: c.id, kind: 'new' }));
  if (previous.pipeline_version !== current.pipeline_version) throw new Error('不同流水线不能共用签收基线');
  if (previous.model !== current.model) throw new Error('不同模型或假模型不能共用签收基线');
  const old = new Map(previous.cases.map(c => [c.id, c.pass])), now = new Map(current.cases.map(c => [c.id, c.pass]));
  return [...new Set([...old.keys(), ...now.keys()])].flatMap(id => {
    const kind = !old.has(id) ? 'new' : !now.has(id) ? 'removed' : old.get(id) && !now.get(id) ? 'regressed' : !old.get(id) && now.get(id) ? 'fixed' : null;
    return kind ? [{ id, kind }] : [];
  });
}
export function baselineAllowed(fake: boolean, model: string, repeat: number) { return !fake && model === DEFAULT_MODEL && repeat === 1; }
export function formatReport(s: Summary, changes: ReturnType<typeof compare>, hasBaseline = false) {
  return [`pipeline=${s.pipeline_version} · model=${s.model} · 结构通过 ${s.passCount}/${s.total}`,
    `完成率=${(s.completion_rate * 100).toFixed(1)}%（产出有效版本/运行次数）；拒绝率=${(s.rejection_rate * 100).toFixed(1)}%（写入/汇总闸门拒绝 ${s.rejected_calls}/全部工具执行 ${s.tool_calls}）`,
    `参数容错解码 coerced_args=${s.coerced_args}（成功 JSON 解码次数，含后续被拒绝的提交；未记录该字段的运行 ${s.coerced_args_unknown} 次，历史缺失无法追溯）`,
    ...s.cases.map(c => `${c.id}: ${c.attempts.filter(a => a.pass).length}/${c.attempts.length} (${(c.pass_rate * 100).toFixed(1)}%) · ${JSON.stringify(c.stop_reasons)}`),
    ...Object.entries(s.by_stage).map(([stage, r]) => `${stage}: ${r.duration_ms}ms · coerced_args=${r.coerced_args} · tokens=${r.usage?.totalTokens ?? 'unknown'} · estimated USD=${r.usage?.cost.total ?? 'unknown'}`),
    `总 token=${s.usage?.totalTokens ?? 'unknown'}；估算 USD=${s.usage?.cost.total ?? 'unknown'}（配置刊例，非账单；fake token 为合成值）`,
    ...(s.model === 'fake' ? ['fake 仅验证结构机制，不参与真模型回归签收'] : []),
    ...(hasBaseline && s.model !== 'fake' ? [] : ['无同系列基线，仅结构机制检查；尚未比较本流水线真模型基线']),
    `vs baseline: ${changes.length ? changes.map(c => `${c.id} ${c.kind}`).join(', ') : 'no change'}`,
    `SIGN-OFF: ${s.total > 0 && s.passCount === s.total && !changes.some(c => c.kind === 'regressed' || c.kind === 'removed') ? (hasBaseline && s.model !== 'fake' ? 'OK' : 'STRUCTURE ONLY') : 'BLOCKED'}（仅结构；人工质量评分不参与放行）`].join('\n') + '\n';
}
