import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, packageRoot, sample } from './testing/fixtures.js';
import { createLocalServer } from './server/index.js';

test('评分按版本保存、重载和汇总，不影响采用；拒绝越界、未知指标与空评分', () => {
  const f = fixture();
  try {
    const v = f.store.writeDraft(f.project.id, 'topic', sample('topic'));
    for (const scores of [{ appeal: 0 }, { appeal: 6 }, { appeal: 1.5 }, { unknown: 3 }, {}]) assert.throws(() => f.store.saveRating(f.project.id, 'topic', v, { scores }));
    assert.throws(() => f.store.saveRating(f.project.id, 'topic', 99, { scores: { appeal: 4 } }));
    f.store.saveRating(f.project.id, 'topic', v, { scores: { appeal: 4 }, note: '有清晰的等待冲突' });
    assert.equal(f.store.load(f.project.id).stages.topic.adopted_version, null);
    assert.equal(f.store.load(f.project.id).ratings?.topic?.[v].scores.appeal, 4);
    f.store.adopt(f.project.id, 'topic', v);
    const v2 = f.store.writeDraft(f.project.id, 'topic', { ...sample('topic'), title: '另一格' });
    assert.equal(f.store.load(f.project.id).ratings?.topic?.[v2], undefined);
    const report = f.store.exportRatings(f.project.id);
    assert.equal(report.rows.length, 1); assert.equal(report.averages.appeal, 4);
    assert.equal(report.rows[0].version, v); assert.equal(report.rows[0].review_status, 'adopted');
    f.store.saveRating(f.project.id, 'topic', v, { scores: { appeal: 3 } });
    assert.equal(f.store.exportRatings(f.project.id).averages.appeal, 3);
  } finally { f.cleanup(); }
});

test('HTTP 评分存取与导出使用现有本机保护；评分错误返回422', async () => {
  const f = fixture(), app = createLocalServer({ root: packageRoot, store: f.store });
  try {
    const base = await app.listen(0), path = `/api/projects/${f.project.id}`;
    f.store.writeDraft(f.project.id, 'topic', sample('topic'));
    const post = (data: unknown) => fetch(base + path + '/stages/topic/rating', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    assert.equal((await post({ version: 1, scores: { appeal: 7 } })).status, 422);
    assert.equal((await post({ version: 1, scores: { appeal: 5 }, note: '冲突清楚' })).status, 200);
    const res = await fetch(base + path + '/ratings');
    assert.equal(res.status, 200); assert.equal((await res.json() as any).averages.appeal, 5);
  } finally { await app.close(); f.cleanup(); }
});
