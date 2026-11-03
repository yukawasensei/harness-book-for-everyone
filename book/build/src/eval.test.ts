import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, packageRoot, sample } from './testing/fixtures.js';
import { loadCases, parseRepeat, compare, summarize, baselineAllowed } from './eval/report.js';
import { evaluateCase } from './eval/evaluate.js';
import { sumUsage } from './eval/usage.js';

test('case 校验拒绝重复 ID、未知阶段、缺失夹具和零预算；repeat 严格解析', () => {
  const cases = loadCases(packageRoot);
  assert.equal(cases.length, 6);
  for (const change of [(c: any) => c.push(c[0]), (c: any) => c[0].stage = 'other', (c: any) => c[1].fixtures = {}, (c: any) => c[0].max_turns = 0]) {
    const c = structuredClone(cases); change(c); assert.throws(() => loadCases(packageRoot, c));
  }
  for (const args of [['--repeat', '0'], ['--repeat=1.5'], ['--oops'], ['--repeat', '2', 'x']]) assert.throws(() => parseRepeat(args));
  assert.equal(parseRepeat([]), 1); assert.equal(parseRepeat(['--repeat=3']), 3);
});

test('假模型逐阶段 eval 经过真实工具和所有存储闸门；重复统计保留每次观察', async () => {
  const f = fixture();
  try {
    const results = [];
    for (const spec of loadCases(packageRoot)) {
      const result = await evaluateCase(packageRoot, f.dir, spec, true);
      assert.equal(result.pass, true, JSON.stringify(result));
      assert.equal(result.completed, true); assert.ok(result.turns <= spec.max_turns);
      assert.ok(result.usage);
      assert.equal(result.usage.cost.total, 0); assert.ok(result.usage.totalTokens > 0);
      results.push({ ...result, attempt: 1 }, { ...result, attempt: 2 });
    }
    const report = summarize('fake', results);
    assert.equal(report.passCount, 12); assert.equal(report.cases.length, 6);
    assert.equal(report.completion_rate, 1); assert.equal(report.by_stage.prompts?.attempts, 2);
    assert.ok(report.rejection_rate > 0);
    const failed = { ...results[0], pass: false, completed: false, stop_reason: 'no_draft' };
    const mixed = summarize('fake', [results[0], failed]);
    assert.equal(mixed.cases[0].pass_rate, .5); assert.equal(mixed.completion_rate, .5);
    assert.equal(mixed.passCount, 1);
    const changes = compare(summarize('fake', [results[0]]), summarize('fake', [failed]));
    assert.equal(changes[0].kind, 'regressed');
    assert.equal(compare(summarize('fake', [failed]), summarize('fake', [results[0]]))[0].kind, 'fixed');
    assert.equal(baselineAllowed(true, 'ollama/qwen3.8:27b', 1), false);
    assert.equal(baselineAllowed(false, 'deepseek/deepseek-flash', 1), false);
    assert.equal(baselineAllowed(false, 'ollama/qwen3.8:27b', 2), false);
    assert.equal(baselineAllowed(false, 'ollama/qwen3.8:27b', 1), true);
  } finally { f.cleanup(); }
});

test('usage 各 token 类与费用分别累计，不伪造缺失 usage', () => {
  const a = { input: 10, output: 20, cacheRead: 3, cacheWrite: 4, totalTokens: 37, cost: { input: .1, output: .2, cacheRead: .03, cacheWrite: .04, total: .37 } };
  assert.deepEqual(sumUsage([a, a]), { input: 20, output: 40, cacheRead: 6, cacheWrite: 8, totalTokens: 74, cost: { input: .2, output: .4, cacheRead: .06, cacheWrite: .08, total: .74 } });
  assert.equal(sumUsage([]), undefined);
});

test('eval 不把文字结束、预算耗尽或超时当成完成；产出版本也不掩盖异常停止', async () => {
  const f = fixture();
  try {
    const spec = loadCases(packageRoot)[0];
    const none = await evaluateCase(packageRoot, f.dir, spec, true, { turns: [{ text: '我已经完成了' }] });
    assert.equal(none.pass, false); assert.equal(none.completed, false); assert.equal(none.stop_reason, 'no_draft');
    const exhausted = await evaluateCase(packageRoot, f.dir, spec, true, { turns: Array.from({ length: 12 }, () => ({ call: 'write_draft', args: { artifact: {} } })) });
    assert.equal(exhausted.pass, false); assert.equal(exhausted.stop_reason, 'max_turns'); assert.equal(exhausted.turns, 8);
    const writtenButOver = await evaluateCase(packageRoot, f.dir, spec, true, { turns: [
      { call: 'write_draft', args: { artifact: sample('topic') } },
      ...Array.from({ length: 10 }, () => ({ call: 'read_upstream', args: {} })),
    ] });
    assert.equal(writtenButOver.completed, true); assert.equal(writtenButOver.pass, false);
    assert.equal(writtenButOver.stop_reason, 'max_turns');
    const timeout = await evaluateCase(packageRoot, f.dir, spec, true, { timeoutMs: 10, waitForAbort: true });
    assert.equal(timeout.pass, false); assert.equal(timeout.stop_reason, 'timeout');
  } finally { f.cleanup(); }
});

test('CLI repeat 报告保留逐 case attempts，不被 case 定义覆盖；fake 更新基线在落盘前拒绝', () => {
  const baseline = join(packageRoot, 'evals/baseline.json');
  const before = existsSync(baseline) ? readFileSync(baseline, 'utf8') : null;
  const env = { ...process.env, EVAL_FAKE: '1', UPDATE_BASELINE: '0' };
  delete (env as NodeJS.ProcessEnv).CASES;
  const run = spawnSync(process.execPath, ['--import', 'tsx', 'src/eval/run-evals.ts', '--repeat', '2'], { cwd: packageRoot, env, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const output = run.stdout.match(/结果：(evals\/runs\/local\/[^\n]+)\//)?.[1];
  assert.ok(output);
  const saved = JSON.parse(readFileSync(join(packageRoot, output, 'summary.json'), 'utf8'));
  assert.equal(saved.cases.length, 6); assert.equal(saved.case_specs.length, 6);
  assert.equal(saved.cases[0].attempts.length, 2); assert.equal(saved.cases[0].pass_rate, 1);
  assert.equal(saved.by_stage.prompts.attempts, 2);
  const blocked = spawnSync(process.execPath, ['--import', 'tsx', 'src/eval/run-evals.ts'], { cwd: packageRoot, env: { ...env, UPDATE_BASELINE: '1' }, encoding: 'utf8' });
  assert.equal(blocked.status, 1); assert.match(blocked.stderr, /假模型不得更新基线/);
  assert.equal(existsSync(baseline) ? readFileSync(baseline, 'utf8') : null, before);
});
