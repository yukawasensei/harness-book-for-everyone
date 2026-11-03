import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, packageRoot, sample } from './testing/fixtures.js';
import { BASELINE_FILE, PIPELINE_VERSION, assertBaseline, formatReport, loadCases, parseRepeat, compare, summarize, baselineAllowed } from './eval/report.js';
import { evaluateCase } from './eval/evaluate.js';
import { sumUsage } from './eval/usage.js';

test('case 校验拒绝重复 ID、未知阶段、缺失夹具和零预算；repeat 严格解析', () => {
  const cases = loadCases(packageRoot);
  assert.equal(cases.length, 4);
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
    assert.equal(report.passCount, 8); assert.equal(report.cases.length, 4);
    assert.equal(report.completion_rate, 1); assert.equal(report.by_stage.board?.attempts, 2);
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
      { call: 'write_draft', args: { artifact: sample('story') } },
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
  const preview = join(packageRoot, BASELINE_FILE);
  const previewBefore = existsSync(preview) ? readFileSync(preview, 'utf8') : null;
  const env = { ...process.env, EVAL_FAKE: '1', UPDATE_BASELINE: '0' };
  delete (env as NodeJS.ProcessEnv).CASES;
  const run = spawnSync(process.execPath, ['--import', 'tsx', 'src/eval/run-evals.ts', '--repeat', '2'], { cwd: packageRoot, env, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const output = run.stdout.match(/结果：(evals\/runs\/local\/[^\n]+)\//)?.[1];
  assert.ok(output);
  const saved = JSON.parse(readFileSync(join(packageRoot, output, 'summary.json'), 'utf8'));
  assert.equal(saved.pipeline_version, PIPELINE_VERSION);
  assert.match(readFileSync(join(packageRoot, output, 'report.md'), 'utf8'), /无同系列基线/);
  assert.equal(saved.cases.length, 4); assert.equal(saved.case_specs.length, 4);
  assert.equal(saved.cases[0].attempts.length, 2); assert.equal(saved.cases[0].pass_rate, 1);
  assert.equal(saved.by_stage.board.attempts, 2);
  assert.deepEqual(Object.keys(saved.by_stage), ['story', 'script', 'bible', 'board']);
  const projects = new Set<string>();
  for (const c of saved.cases) for (const a of c.attempts) {
    assert.equal(a.stop_reason, 'draft_written');
    assert.ok(a.usage.totalTokens > 0); assert.ok(a.rejected_calls > 0);
    assert.deepEqual(JSON.parse(readFileSync(join(packageRoot, output, `${c.id}-${a.attempt}.json`), 'utf8')), a);
    projects.add(a.project);
  }
  assert.equal(projects.size, 8, '每次观察必须是独立运行');
  const blocked = spawnSync(process.execPath, ['--import', 'tsx', 'src/eval/run-evals.ts'], { cwd: packageRoot, env: { ...env, UPDATE_BASELINE: '1' }, encoding: 'utf8' });
  assert.equal(blocked.status, 1); assert.match(blocked.stderr, /假模型不得更新基线/);
  assert.equal(existsSync(baseline) ? readFileSync(baseline, 'utf8') : null, before);
  assert.equal(existsSync(preview) ? readFileSync(preview, 'utf8') : null, previewBefore);
});

test('CLI 非法更新、筛选、repeat 和超时配置均在创建输出前拒绝', () => {
  const outputRoot = join(packageRoot, 'evals/runs/local/fake');
  const before = existsSync(outputRoot) ? readdirSync(outputRoot).sort() : [];
  for (const [vars, args, error] of [
    [{ UPDATE_BASELINE: '1' }, [], /假模型不得更新基线/],
    [{ CASES: 'story-draft' }, [], /不支持 CASES/],
    [{}, ['--repeat', '0'], /正整数/],
    [{ EVAL_TIMEOUT_MS: '0' }, [], /必须为正整数/],
  ] as const) {
    const env: NodeJS.ProcessEnv = { ...process.env, EVAL_FAKE: '1', UPDATE_BASELINE: '0' };
    delete env.CASES;
    Object.assign(env, vars);
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/eval/run-evals.ts', ...args], { cwd: packageRoot, env, encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, error);
  }
  assert.deepEqual(existsSync(outputRoot) ? readdirSync(outputRoot).sort() : [], before);
});

test('流水线身份隔离旧基线；同系列仍检查 removed、regressed 和模型身份', () => {
  const spec = loadCases(packageRoot)[0];
  const result = { id: spec.id, stage: spec.stage, pass: true, completed: true, version: 1,
    stop_reason: 'draft_written', turns: 1, max_turns: 8, duration_ms: 1,
    tool_calls: 1, rejected_calls: 0, errors: [] };
  const current = summarize('fake', [result]);
  assert.throws(() => compare({ ...current, pipeline_version: 'reelloom-6stage-v1' }, current), /不同流水线/);
  const legacy = structuredClone(current); Reflect.deleteProperty(legacy, 'pipeline_version');
  assert.throws(() => compare(legacy, current), /不同流水线/);
  assert.throws(() => compare(summarize('other-model', [result]), current), /不同模型/);
  assert.deepEqual(compare(current, summarize('fake', [])), [{ id: spec.id, kind: 'removed' }]);
  assert.deepEqual(compare(current, summarize('fake', [{ ...result, pass: false }])), [{ id: spec.id, kind: 'regressed' }]);
  assert.match(formatReport(current, compare(undefined, current)), /SIGN-OFF: STRUCTURE ONLY/);
  assert.match(formatReport(current, compare(undefined, current)), /无同系列基线/);
});

test('全量 cases 必须覆盖四个不同阶段，不允许遗漏、重复阶段或夹具别名', () => {
  const cases = loadCases(packageRoot);
  assert.throws(() => loadCases(packageRoot, cases.slice(0, 3)), /四阶段/);
  const duplicate = structuredClone(cases);
  duplicate[3] = { ...duplicate[0], id: 'another-story' };
  assert.throws(() => loadCases(packageRoot, duplicate), /四阶段/);
  const extra = structuredClone(cases);
  extra[1].fixtures = { synopsis: 'story.json' } as any;
  assert.throws(() => loadCases(packageRoot, extra), /上游夹具/);
});

test('真模型基线拒绝 fake、非单轮、不完整签收与配置漂移', async () => {
  const f = fixture();
  try {
    const cases = loadCases(packageRoot);
    const results = [];
    for (const spec of cases) results.push({ ...await evaluateCase(packageRoot, f.dir, spec, true), attempt: 1 });
    // 合成的基线元数据仅用于验证 guard；不写任何真模型 baseline。
    const baseline = { ...summarize('ollama/qwen3.8:27b', results), fake: false, repeat: 1, case_specs: cases };
    assert.doesNotThrow(() => assertBaseline(baseline, cases));
    for (const mutate of [
      (b: any) => b.fake = true,
      (b: any) => delete b.fake,
      (b: any) => b.repeat = 2,
      (b: any) => b.pipeline_version = 'reelloom-6stage-v1',
      (b: any) => b.model = 'other',
      (b: any) => b.cases.pop(),
      (b: any) => b.cases[0].attempts[0].stop_reason = 'max_turns',
      (b: any) => b.cases[0].attempts[0].pass = false,
      (b: any) => b.case_specs[0].instructions += ' changed',
    ]) {
      const invalid = structuredClone(baseline); mutate(invalid);
      assert.throws(() => assertBaseline(invalid, cases), /基线/);
    }
  } finally { f.cleanup(); }
});

test('fake 即使收到基线标记也只能签结构机制，空报告不能签收', () => {
  const result = { id: 'story-draft', stage: 'story' as const, pass: true, completed: true, version: 1,
    stop_reason: 'draft_written', turns: 1, max_turns: 8, duration_ms: 1, tool_calls: 1, rejected_calls: 0, errors: [] };
  assert.match(formatReport(summarize('fake', [result]), [], true), /SIGN-OFF: STRUCTURE ONLY/);
  assert.match(formatReport(summarize('fake', []), []), /SIGN-OFF: BLOCKED/);
});

test('四阶段夹具与样例可经存储全链采用，board 只保留一份精确派生提示词', () => {
  for (const source of ['evals/fixtures', 'examples/sample-project']) {
    const f = fixture();
    try {
      for (const spec of loadCases(packageRoot)) {
        const artifact = JSON.parse(readFileSync(join(packageRoot, source, `${spec.stage}.json`), 'utf8'));
        const version = f.store.writeDraft(f.project.id, spec.stage, artifact);
        f.store.adopt(f.project.id, spec.stage, version);
        assert.deepEqual(f.store.readVersion(f.project.id, spec.stage, version), artifact);
      }
      assert.deepEqual(Object.keys(f.store.load(f.project.id).stages), ['story', 'script', 'bible', 'board']);
    } finally { f.cleanup(); }
  }
});
