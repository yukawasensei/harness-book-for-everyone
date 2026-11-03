import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { evaluateCase } from './eval/evaluate.js';
import { formatReport, loadCases, summarize } from './eval/report.js';
import { fixture, packageRoot, sample } from './testing/fixtures.js';
import type { Stage } from './contracts/index.js';
import type { Turn } from './testing/fake-model.js';

function submission(stage: Stage, encoded: boolean): Turn[] {
  const payload = <T,>(v: T) => encoded ? JSON.stringify(v) : v;
  if (stage === 'script') return [
    ...sample('script').scenes.map((scene, i) => ({ call: 'write_scene', args: { scene: i === 0 ? payload(scene) : scene } })),
    { call: 'finalize_draft', args: {} }, { text: '完成' },
  ];
  if (stage === 'storyboard') {
    const board = sample('storyboard');
    return [...['S01', 'S02', 'S03'].map((scene_id, i) => {
      const scene = { scene_id, shots: board.shots.filter(s => s.scene_id === scene_id) };
      return { call: 'write_scene_shots', args: { scene: i === 0 ? payload(scene) : scene } };
    }), { call: 'finalize_draft', args: {} }, { text: '完成' }];
  }
  return [{ call: 'write_draft', args: { artifact: payload(sample(stage)) } }, { text: '完成' }];
}

for (const stage of ['topic', 'synopsis', 'bible', 'script', 'storyboard'] as const) {
  test(`${stage} 字符串编码提交通过真实 SDK 和原闸门，计数 +1；对象形态保持 +0`, async () => {
    const f = fixture();
    try {
      const spec = loadCases(packageRoot).find(s => s.stage === stage)!;
      for (const encoded of [false, true]) {
        const r = await evaluateCase(packageRoot, f.dir, spec, true, { turns: submission(stage, encoded) });
        assert.equal(r.pass, true, JSON.stringify(r)); assert.equal(r.coerced_args, encoded ? 1 : 0);
        assert.deepEqual(f.store.load(f.project.id).stages.topic.versions, []);
        const version = JSON.parse(readFileSync(join(f.dir, r.project!, 'artifacts', stage, 'v1.json'), 'utf8'));
        assert.deepEqual(version, sample(stage));
        const sessionFiles = readdirSync(join(f.dir, r.project!, 'sessions'));
        const entries = sessionFiles.flatMap(file => readFileSync(join(f.dir, r.project!, 'sessions', file), 'utf8').trim().split('\n').map(line => JSON.parse(line)));
        assert.equal(entries.find(e => e.customType === 'stage_run_end')?.data.coerced_args, encoded ? 1 : 0);
      }
    } finally { f.cleanup(); }
  });
}

test('非法 JSON、错误类型与数字字符串给出参数路径、期望/实际类型和一行示例，不落版本', async () => {
  const f = fixture();
  try {
    const spec = loadCases(packageRoot)[0];
    for (const [artifact, path, given] of [
      ['{bad', 'artifact', '字符串'],
      [[], 'artifact', '数组'],
      [JSON.stringify({ ...sample('topic'), target_minutes: '12' }), 'artifact.target_minutes', '字符串'],
    ] as const) {
      const r = await evaluateCase(packageRoot, f.dir, spec, true, { turns: [{ call: 'write_draft', args: { artifact } }, { text: '停止' }] });
      assert.equal(r.pass, false); assert.equal(r.version, null);
      assert.match(r.errors.join('\n'), new RegExp(path));
      assert.match(r.errors.join('\n'), /期望/); assert.match(r.errors.join('\n'), new RegExp(`实际.*${given}`));
      assert.match(r.errors.join('\n'), /正确示例/);
      assert.equal(r.coerced_args, typeof artifact === 'string' && artifact !== '{bad' ? 1 : 0);
    }
  } finally { f.cleanup(); }
});

test('嵌套数组与数组中对象按契约解码；不解码业务文字、不绕过引用闸门；汇总与报告有计数', async () => {
  const f = fixture();
  try {
    const spec = loadCases(packageRoot).find(s => s.stage === 'synopsis')!;
    const value = sample('synopsis');
    value.title = '{"这是片名而不是对象":true}';
    const r = await evaluateCase(packageRoot, f.dir, spec, true, { turns: [{ call: 'write_draft', args: { artifact: JSON.stringify({ ...value, beats: JSON.stringify(value.beats) }) } }, { text: '完成' }] });
    assert.equal(r.pass, true); assert.equal(r.coerced_args, 2);
    const report = summarize('fake', [r, r]);
    assert.equal(report.coerced_args, 4); assert.equal(report.by_stage.synopsis.coerced_args, 4);
    assert.match(formatReport(report, []), /coerced_args=4/);
    const boardSpec = loadCases(packageRoot).find(s => s.stage === 'storyboard')!;
    const board = sample('storyboard');
    const turns = submission('storyboard', false);
    const badShots = board.shots.filter(s => s.scene_id === 'S01').map(s => JSON.stringify({ ...s, prop_ids: ['P99'] }));
    turns[0] = { call: 'write_scene_shots', args: { scene: JSON.stringify({ scene_id: 'S01', shots: JSON.stringify(badShots) }) } };
    const bad = await evaluateCase(packageRoot, f.dir, boardSpec, true, { turns });
    assert.equal(bad.pass, false); assert.equal(bad.version, null); assert.match(bad.errors.join('\n'), /P99/);
    assert.equal(bad.coerced_args, 2 + board.shots.filter(s => s.scene_id === 'S01').length);
  } finally { f.cleanup(); }
});
