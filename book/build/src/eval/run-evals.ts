import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { configuredModel, DEFAULT_MODEL, scrubSecrets } from '../agent/model.js';
import { baselineAllowed, compare, formatReport, loadCases, parseRepeat, summarize, type Result, type Summary } from './report.js';
import { evaluateCase } from './evaluate.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
async function main() {
  const repeat = parseRepeat(process.argv.slice(2));
  const fake = process.env.EVAL_FAKE === '1';
  const selected = fake ? null : configuredModel(root); // 配置错误时尚未创建运行目录。
  const model = selected ? `${selected.provider}/${selected.id}` : 'fake';
  const update = process.env.UPDATE_BASELINE === '1';
  if (update && !baselineAllowed(fake, model, repeat)) throw new Error('更新基线需要真实默认 Qwen、全量、repeat=1；假模型不得更新基线');
  if (process.env.CASES !== undefined) throw new Error('本包只支持全量评测，不支持 CASES');
  const cases = loadCases(root);
  const timeoutMs = Number(process.env.EVAL_TIMEOUT_MS ?? 600_000);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error('EVAL_TIMEOUT_MS 必须为正整数');
  const baselinePath = join(root, 'evals/baseline.json');
  const previous: Summary | undefined = model === DEFAULT_MODEL && existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : undefined;
  const dir = join(root, 'evals/runs/local', model.replace(/[^a-zA-Z0-9_-]/g, '-'), `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  const results: Result[] = [];
  for (const spec of cases) for (let attempt = 1; attempt <= repeat; attempt++) {
    const result = { ...await evaluateCase(root, dir, spec, fake, { timeoutMs }), attempt };
    results.push(result);
    writeFileSync(join(dir, `${spec.id}-${attempt}.json`), scrubSecrets(JSON.stringify(result, null, 2)) + '\n');
    console.log(`${spec.id} ${attempt}/${repeat}: ${result.pass ? 'PASS' : 'FAIL'} ${result.stop_reason}`);
    // 每次落盘，失败保留且不补跑。
    writeFileSync(join(dir, 'summary.json'), scrubSecrets(JSON.stringify({ ...summarize(model, results), repeat, fake, timeout_ms: timeoutMs, case_specs: cases, run_dir: relative(root, dir) }, null, 2)) + '\n');
  }
  const current = { ...summarize(model, results), repeat, fake, case_specs: cases, run_dir: relative(root, dir) }, changes = compare(previous, current), report = formatReport(current, changes);
  writeFileSync(join(dir, 'report.md'), report);
  console.log(report);
  console.log(`结果：${resolve(dir).slice(root.length + 1)}/`);
  const passed = current.passCount === current.total && !changes.some(c => ['regressed', 'removed'].includes(c.kind));
  process.exitCode = passed ? 0 : 1;
  if (update && passed) {
    writeFileSync(`${baselinePath}.tmp`, scrubSecrets(JSON.stringify(current, null, 2)) + '\n');
    renameSync(`${baselinePath}.tmp`, baselinePath);
    console.log('已更新 evals/baseline.json；需人工审阅后提交。');
  }
}
main().catch(error => { console.error(scrubSecrets(String(error))); process.exitCode = 1; });
