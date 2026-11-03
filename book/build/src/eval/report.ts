import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STAGES, parseStage, validateArtifact, type Stage } from '../contracts/index.js';
import { STAGE_TURN_LIMITS } from '../agent/run.js';
import { sumUsage } from './usage.js';
import type { Usage } from '@earendil-works/pi-ai';

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
    if (!c.fixtures || typeof c.fixtures !== 'object' || Array.isArray(c.fixtures) || Object.keys(c.fixtures).length !== upstream.length) throw new Error('case 需要固定的全部上游夹具');
    for (const stage of upstream) {
      const file = c.fixtures[stage];
      if (typeof file !== 'string' || !/^[a-z0-9-]+\.json$/.test(file)) throw new Error('夹具文件名不合规');
      validateArtifact(stage, JSON.parse(readFileSync(join(root, 'evals/fixtures', file), 'utf8')));
    }
  }
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
  return { model, total: results.length, passCount: results.filter(r => r.pass).length, cases, by_stage,
    completion_rate: results.length ? results.filter(r => r.completed).length / results.length : 0,
    coerced_args: results.reduce((s, r) => s + (r.coerced_args ?? 0), 0), coerced_args_unknown: results.filter(r => r.coerced_args === undefined).length, tool_calls: calls, rejected_calls: rejected, rejection_rate: calls ? rejected / calls : 0,
    usage: sumUsage(results.flatMap(r => r.usage ? [r.usage] : [])) };
}
export type Summary = ReturnType<typeof summarize>;
export function compare(previous: Summary | undefined, current: Summary) {
  if (!previous) return current.cases.map(c => ({ id: c.id, kind: 'new' }));
  if (previous.model !== current.model) throw new Error('不同模型或假模型不能共用签收基线');
  const old = new Map(previous.cases.map(c => [c.id, c.pass])), now = new Map(current.cases.map(c => [c.id, c.pass]));
  return [...new Set([...old.keys(), ...now.keys()])].flatMap(id => {
    const kind = !old.has(id) ? 'new' : !now.has(id) ? 'removed' : old.get(id) && !now.get(id) ? 'regressed' : !old.get(id) && now.get(id) ? 'fixed' : null;
    return kind ? [{ id, kind }] : [];
  });
}
export function baselineAllowed(fake: boolean, model: string, repeat: number) { return !fake && model === 'ollama/qwen3.8:27b' && repeat === 1; }
export function formatReport(s: Summary, changes: ReturnType<typeof compare>) {
  return [`model=${s.model} · 结构通过 ${s.passCount}/${s.total}`,
    `完成率=${(s.completion_rate * 100).toFixed(1)}%（产出有效版本/运行次数）；拒绝率=${(s.rejection_rate * 100).toFixed(1)}%（写入/汇总闸门拒绝 ${s.rejected_calls}/全部工具执行 ${s.tool_calls}）`,
    `参数容错解码 coerced_args=${s.coerced_args}（成功 JSON 解码次数，含后续被拒绝的提交；未记录该字段的运行 ${s.coerced_args_unknown} 次，历史缺失无法追溯）`,
    ...s.cases.map(c => `${c.id}: ${c.attempts.filter(a => a.pass).length}/${c.attempts.length} (${(c.pass_rate * 100).toFixed(1)}%) · ${JSON.stringify(c.stop_reasons)}`),
    ...Object.entries(s.by_stage).map(([stage, r]) => `${stage}: ${r.duration_ms}ms · coerced_args=${r.coerced_args} · tokens=${r.usage?.totalTokens ?? 'unknown'} · estimated USD=${r.usage?.cost.total ?? 'unknown'}`),
    `总 token=${s.usage?.totalTokens ?? 'unknown'}；估算 USD=${s.usage?.cost.total ?? 'unknown'}（配置刊例，非账单；fake token 为合成值）`,
    `vs baseline: ${changes.length ? changes.map(c => `${c.id} ${c.kind}`).join(', ') : 'no change'}`,
    `SIGN-OFF: ${s.passCount === s.total && !changes.some(c => c.kind === 'regressed' || c.kind === 'removed') ? 'OK' : 'BLOCKED'}（仅结构；fake 仅验证机制）`].join('\n') + '\n';
}
